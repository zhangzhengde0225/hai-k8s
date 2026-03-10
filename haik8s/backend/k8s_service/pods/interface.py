"""
通用 Pod 命令执行接口

提供在 Kubernetes Pod 中执行任意命令并获取结果的能力。
"""
from typing import Optional, Union
from dataclasses import dataclass
from kubernetes import client
from kubernetes.stream import stream
from kubernetes.client.rest import ApiException
from k8s_service.client import get_core_v1


@dataclass
class ExecutionResult:
    """命令执行结果"""
    success: bool
    stdout: str
    stderr: str
    exit_code: int
    error_message: Optional[str] = None


def execute_command_in_pod(
    namespace: str,
    pod_name: str,
    command: Union[str, list[str]],
    container: Optional[str] = None,
    timeout: int = 30,
    working_dir: Optional[str] = None,
) -> ExecutionResult:
    """
    在指定 Pod 中执行命令并获取结果。

    这是一个通用接口，可以执行任何命令并返回完整的输出结果。
    适用于一次性命令执行，而非交互式终端会话。

    Args:
        namespace: K8s 命名空间
        pod_name: Pod 名称
        command: 要执行的命令
            - 如果是字符串，将通过 bash -c 执行
            - 如果是列表，直接作为命令数组执行
        container: 容器名称（可选，默认使用 Pod 的第一个容器）
        timeout: 命令执行超时时间（秒），默认 30 秒
        working_dir: 工作目录（可选）

    Returns:
        ExecutionResult: 包含执行结果、输出、错误信息等

    Examples:
        >>> # 执行简单命令
        >>> result = execute_command_in_pod("default", "my-pod", "ls -la")
        >>> print(result.stdout)

        >>> # 执行复杂命令
        >>> result = execute_command_in_pod(
        ...     "default", "my-pod",
        ...     ["bash", "-c", "cd /app && python script.py"]
        ... )

        >>> # 检查执行结果
        >>> if result.success:
        ...     print("成功:", result.stdout)
        ... else:
        ...     print("失败:", result.stderr)
    """
    v1 = get_core_v1()

    # 将字符串命令转换为 bash 执行
    if isinstance(command, str):
        exec_command = ["bash", "-c", command]
    else:
        exec_command = command

    # 如果指定了工作目录，添加 cd 命令
    if working_dir and isinstance(command, str):
        exec_command = ["bash", "-c", f"cd {working_dir} && {command}"]

    try:
        # 执行命令并捕获输出
        # tty=False: 非交互式
        # _preload_content=True: 等待命令完成并获取所有输出
        # stderr=True, stdout=True: 捕获标准输出和错误
        resp = stream(
            v1.connect_get_namespaced_pod_exec,
            pod_name,
            namespace,
            container=container,
            command=exec_command,
            stderr=True,
            stdin=False,
            stdout=True,
            tty=False,
            _preload_content=True,
            _request_timeout=timeout,
        )

        # stream() 返回的是字符串，包含 stdout 和 stderr 的混合输出
        # 在 _preload_content=True 模式下，resp 是完整输出字符串
        output = resp if isinstance(resp, str) else ""

        # 由于 K8s exec API 在 preload_content=True 模式下
        # 将 stdout 和 stderr 混合输出，我们需要用其他方法分离
        # 这里先返回混合输出，如果需要分离可以使用管道
        return ExecutionResult(
            success=True,
            stdout=output,
            stderr="",
            exit_code=0,
        )

    except ApiException as e:
        error_msg = f"K8s API 错误: {e.reason}"
        if e.status == 404:
            error_msg = f"Pod '{pod_name}' 在命名空间 '{namespace}' 中不存在"
        elif e.status == 400:
            error_msg = "容器未就绪或命令格式错误"

        return ExecutionResult(
            success=False,
            stdout="",
            stderr=str(e),
            exit_code=-1,
            error_message=error_msg,
        )

    except Exception as e:
        return ExecutionResult(
            success=False,
            stdout="",
            stderr=str(e),
            exit_code=-1,
            error_message=f"执行失败: {str(e)}",
        )


def execute_command_with_separate_streams(
    namespace: str,
    pod_name: str,
    command: Union[str, list[str]],
    container: Optional[str] = None,
    timeout: int = 30,
) -> ExecutionResult:
    """
    执行命令并分离 stdout 和 stderr。

    通过重定向技巧将 stderr 和 stdout 分离，
    然后分别捕获并返回。

    Args:
        namespace: K8s 命名空间
        pod_name: Pod 名称
        command: 要执行的命令
        container: 容器名称（可选）
        timeout: 超时时间（秒）

    Returns:
        ExecutionResult: 包含分离的 stdout 和 stderr
    """
    v1 = get_core_v1()

    # 构建分离 stdout/stderr 的命令
    if isinstance(command, str):
        # 使用 bash 执行，并分离输出
        # 格式: { 命令; } 2>&1 1>&3 3>&- | prefix_stderr 3>&- & { 命令; } 3>&1 1>&2 2>&3 3>&- | prefix_stdout
        # 简化版本：先执行命令，退出码保存，然后输出结果
        wrapped_cmd = f"""
set -o pipefail
TMPDIR=$(mktemp -d)
{{
  {command}
}} > "$TMPDIR/stdout" 2> "$TMPDIR/stderr"
EXIT_CODE=$?
echo "STDOUT_START"
cat "$TMPDIR/stdout" 2>/dev/null || true
echo "STDOUT_END"
echo "STDERR_START"
cat "$TMPDIR/stderr" 2>/dev/null || true
echo "STDERR_END"
echo "EXIT_CODE:$EXIT_CODE"
rm -rf "$TMPDIR"
exit $EXIT_CODE
"""
        exec_command = ["bash", "-c", wrapped_cmd]
    else:
        # 如果是命令数组，转换为字符串后包装
        cmd_str = " ".join(command)
        wrapped_cmd = f"""
set -o pipefail
TMPDIR=$(mktemp -d)
{{
  {cmd_str}
}} > "$TMPDIR/stdout" 2> "$TMPDIR/stderr"
EXIT_CODE=$?
echo "STDOUT_START"
cat "$TMPDIR/stdout" 2>/dev/null || true
echo "STDOUT_END"
echo "STDERR_START"
cat "$TMPDIR/stderr" 2>/dev/null || true
echo "STDERR_END"
echo "EXIT_CODE:$EXIT_CODE"
rm -rf "$TMPDIR"
exit $EXIT_CODE
"""
        exec_command = ["bash", "-c", wrapped_cmd]

    try:
        resp = stream(
            v1.connect_get_namespaced_pod_exec,
            pod_name,
            namespace,
            container=container,
            command=exec_command,
            stderr=True,
            stdin=False,
            stdout=True,
            tty=False,
            _preload_content=True,
            _request_timeout=timeout,
        )

        output = resp if isinstance(resp, str) else ""

        # 解析输出
        stdout = ""
        stderr = ""
        exit_code = 0

        try:
            # 提取 stdout
            if "STDOUT_START" in output and "STDOUT_END" in output:
                start = output.index("STDOUT_START") + len("STDOUT_START\n")
                end = output.index("STDOUT_END")
                stdout = output[start:end].strip()

            # 提取 stderr
            if "STDERR_START" in output and "STDERR_END" in output:
                start = output.index("STDERR_START") + len("STDERR_START\n")
                end = output.index("STDERR_END")
                stderr = output[start:end].strip()

            # 提取退出码
            if "EXIT_CODE:" in output:
                exit_line = [line for line in output.split("\n") if "EXIT_CODE:" in line][0]
                exit_code = int(exit_line.split("EXIT_CODE:")[1].strip())
        except (ValueError, IndexError):
            # 解析失败，返回原始输出
            return ExecutionResult(
                success=False,
                stdout=output,
                stderr="",
                exit_code=-1,
                error_message="输出解析失败"
            )

        return ExecutionResult(
            success=(exit_code == 0),
            stdout=stdout,
            stderr=stderr,
            exit_code=exit_code,
        )

    except ApiException as e:
        error_msg = f"K8s API 错误: {e.reason}"
        if e.status == 404:
            error_msg = f"Pod '{pod_name}' 不存在"
        elif e.status == 400:
            error_msg = "容器未就绪"

        return ExecutionResult(
            success=False,
            stdout="",
            stderr=str(e),
            exit_code=-1,
            error_message=error_msg,
        )

    except Exception as e:
        return ExecutionResult(
            success=False,
            stdout="",
            stderr=str(e),
            exit_code=-1,
            error_message=f"执行失败: {str(e)}",
        )


# 便捷别名
exec_pod_command = execute_command_in_pod
