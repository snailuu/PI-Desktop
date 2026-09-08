# ADR 0051：将主机 RPC stdio 与 Tokio 阻塞池隔离

> **翻译说明：** 本页是与 [英文源决策](/adr/0051-host-rpc-stdio-resource-isolation) 一一对应的机器辅助翻译。代码、协议字段和标识符保持原文；如翻译与英文源事实有歧义，以英文版本为准。

- 状态：已接受
- 日期：2026-08-04

## 上下文

宿主已经对 RPC 任务、工具类别、shell 进程和排队的工作做了边界限制。但并行的 Bash 突发仍可能以 `Resource temporarily unavailable (os error 35)` 终止宿主。Electron 正确地将该子进程退出映射为 `HOST_UNAVAILABLE`，但这种映射把进程级故障对会话隐藏了起来。

剩余的控制路径风险在于 host-core 对 `tokio::io::stdin()` 和 `tokio::io::stdout()` 的使用。Tokio 通过其阻塞池实现这些适配器。当操作系统拒绝再创建一个工作线程时，非强制的阻塞任务 spawn 路径会 panic，而不是返回普通的 I/O 错误。于是宿主在工具请求仍在处理中时退出。Unix 登录 shell 的 PATH 探测存在同一问题的第二个实例，因为当操作系统无法创建线程时，普通的 `std::thread::spawn` 会 panic。

## 决策

1. host-core 的 NDJSON stdin 读取器运行在用 `std::thread::Builder` 创建的一个具名线程上。其 stdout 写入器运行在第二个具名线程上。异步 RPC 调度器通过通道与这些线程通信；请求任务和工具任务绝不调用 Tokio 的 stdio 适配器。
2. 控制线程以短暂且有界的延迟重试 `EINTR` 以及瞬时的 `EAGAIN`/`EWOULDBLOCK`（`errno` 11 或 35）。读取器会保留不完整输入，直到完整的一行到达；写入器会跟踪部分写入，因此重试不会重复写入字节。
3. 创建控制线程失败会作为宿主启动错误返回。管道关闭或不可恢复会结束宿主的正常生命周期，并且对 Electron 的代际感知监督保持可见；它绝不会被转换成未处理的 Rust 线程 spawn panic。
4. 登录 shell 的 PATH 探测同样使用 `thread::Builder`；如果这个可选辅助线程无法启动，Bash 会回退到继承的宿主 PATH。现有的 RPC 和工具准入限制保持不变。

## 后果

- 临时的操作系统线程压力不再触及 Tokio 那条“无工作线程即 panic”的 stdio 路径，从而消除了 `HOST_UNAVAILABLE` 背后已观察到的宿主退出原因。
- 宿主拥有两个长期存活的控制线程，而不是为每次 stdio 操作创建一个阻塞池工作线程。
- NDJSON 分帧、响应顺序、请求并发和过载错误码保持不变。
- 真正不可用的 stdin/stdout 管道仍会终止宿主，并由现有的 Electron 重启/致命降级策略处理。

## 备选方案

### 提高 Tokio 阻塞池上限

已否决。这会增加竞争同一已耗尽操作系统资源的线程数量，并使“线程创建即 panic”的路径保持原样。

### 保留 Tokio stdio 并捕获 panic

已否决。围绕异步运行时捕获 panic 会很脆弱，也无法让部分 NDJSON 写入或关闭顺序变得显式。

### 改为移除并发限制

已否决。工具和子进程仍然需要准入限制；移除它们并不能解决控制管道对动态阻塞池工作线程的独立依赖。

## 参考资料

- `crates/host-core/src/rpc/mod.rs`
- `crates/host-core/src/tools/shell.rs`
- `docs/spec/03-runtime/05-host-core-rust.md`
- `docs/spec/03-runtime/06-host-rpc-protocol.md`
- `docs/spec/03-runtime/07-process-model.md`
- `docs/spec/06-delivery/04-e2e-test-plan.md`
- Decision D187
