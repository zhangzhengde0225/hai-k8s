#!/usr/bin/env python3
"""
User Injection Script Generator for Kubernetes Pods

This module provides functions to generate bash scripts for injecting custom users
into Kubernetes containers with specific UID, GID, .bashrc configuration, and sudo privileges.

Author: Zhengde ZHANG
"""

from typing import Optional


def generate_default_bashrc() -> str:
    """
    Generate a default .bashrc configuration.

    Returns:
        str: Default .bashrc content
    """
    return """# ~/.bashrc: executed by bash(1) for non-login shells.

# If not running interactively, don't do anything
case $- in
    *i*) ;;
      *) return;;
esac

# ============================================================================
# Shell Options
# ============================================================================
shopt -s histappend    # Append to history file
shopt -s checkwinsize  # Check window size after each command

# ============================================================================
# History Settings
# ============================================================================
HISTCONTROL=ignoreboth
HISTSIZE=1000
HISTFILESIZE=2000

# ============================================================================
# Color Support
# ============================================================================
if command -v dircolors > /dev/null 2>&1; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
fi

# ============================================================================
# Aliases
# ============================================================================
alias ls='ls --color=auto'
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias grep='grep --color=auto'
alias fgrep='fgrep --color=auto'
alias egrep='egrep --color=auto'

# ============================================================================
# Prompt
# ============================================================================
PS1='\\[\\033[01;35m\\][\\[\\033[00m\\]\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\] \\[\\033[01;34m\\]\\W\\[\\033[00m\\]\\[\\033[01;35m\\]]\\[\\033[00m\\]\\$ '

# ============================================================================
# Bash Completion
# ============================================================================
if ! shopt -oq posix; then
    [ -f /usr/share/bash-completion/bash_completion ] && . /usr/share/bash-completion/bash_completion
    [ -f /etc/bash_completion ] && . /etc/bash_completion
fi

# ============================================================================
# Utilities
# ============================================================================
[ -x /usr/bin/lesspipe ] && eval "$(SHELL=/bin/sh lesspipe)"

# User specific aliases and functions
"""


def generate_user_injection_script(
    username: str,
    uid: int,
    gid: int,
    ssh_enabled: bool = True,
    bashrc_content: Optional[str] = None,
    enable_sudo: bool = True,
    home_dir: Optional[str] = None,
    shell: str = "/bin/bash",
) -> str:
    """
    Generate a bash script to inject a custom user into a container.

    Args:
        username: Username to create
        uid: User ID
        gid: Group ID
        ssh_enabled: Whether SSH is enabled (affects startup command)
        bashrc_content: Custom .bashrc content (uses default if None)
        enable_sudo: Whether to grant sudo privileges to the user
        home_dir: Custom home directory (defaults to /home/{username})
        shell: User's login shell (default: /bin/bash)

    Returns:
        str: Bash script content for user injection
    """
    if home_dir is None:
        home_dir = f"/home/{username}"

    if bashrc_content is None:
        bashrc_content = generate_default_bashrc()

    # No escaping needed for single-quoted heredoc
    # The heredoc with 'BASHRC_EOF' treats content as literal

    script = f"""#!/bin/bash
set -e

echo "=== HAI-K8S User Injection Script ==="
echo "Username: {username}"
echo "UID: {uid}"
echo "GID: {gid}"
echo "Home: {home_dir}"
echo "Shell: {shell}"
echo "Sudo enabled: {enable_sudo}"
echo ""

# ============================================================================
# Step 1: Create group
# ============================================================================
echo "[1/6] Creating group '{username}' with GID {gid}..."
if getent group {gid} > /dev/null 2>&1; then
    echo "  ⚠️  GID {gid} already exists:"
    getent group {gid}
    echo "  Using existing group"
else
    groupadd -g {gid} {username}
    echo "  ✅ Group created"
fi

# ============================================================================
# Step 2: Create user
# ============================================================================
echo "[2/6] Creating user '{username}' with UID {uid}..."
if id -u {username} > /dev/null 2>&1; then
    echo "  ⚠️  User '{username}' already exists"
    id {username}
else
    useradd -u {uid} -g {gid} -m -d {home_dir} -s {shell} {username}
    echo "  ✅ User created"
fi

# ============================================================================
# Step 3: Setup home directory (only if not already mounted)
# ============================================================================
echo "[3/6] Setting up home directory..."
if [ ! -d "{home_dir}" ]; then
    echo "  ➤ Home directory does not exist. Creating..."
    mkdir -p "{home_dir}"
    chown {uid}:{gid} "{home_dir}"
    chmod 755 "{home_dir}"
else
    echo "  ➤ Home directory already exists (likely mounted)."
    # Only fix ownership of the top-level directory, DO NOT recurse!
    # Skip if already correct to avoid permission errors
    CURRENT_OWNER=$(stat -c '%u:%g' "{home_dir}")
    if [ "$CURRENT_OWNER" != "{uid}:{gid}" ]; then
        echo "  ➤ Fixing ownership of top-level directory only..."
        chown {uid}:{gid} "{home_dir}"
    else
        echo "  ➤ Ownership already correct."
    fi
fi

# Deprecated: For OpenClaw，需要额外创建一个 .hai-openclaw 目录，并设置正确的权限
# if [ ! -d "{home_dir}/.hai-openclaw" ]; then
#     echo "  ➤ Creating .hai-openclaw directory for OpenClaw..."
#     mkdir -p "{home_dir}/.hai-openclaw"
#     chown {uid}:{gid} "{home_dir}/.hai-openclaw"
#     chmod 755 "{home_dir}/.hai-openclaw"
# else
#     echo "  ➤ .hai-openclaw directory already exists."
# fi

echo "  ✅ Home directory configured"

# ============================================================================
# Step 4: Inject global shell config...
# ============================================================================
echo "[4/6] Injecting global shell configuration..."
GLOBAL_PROFILE_SCRIPT="/etc/profile.d/haik8s_app.sh"

# Check if the global script already exists
if [ -f "$GLOBAL_PROFILE_SCRIPT" ]; then
    echo "  ➤ Global profile script already exists. Skipping injection."
else
    echo "  ➤ Creating global profile script: $GLOBAL_PROFILE_SCRIPT"
    # Write the content as root (no need for 'su')
    cat > "$GLOBAL_PROFILE_SCRIPT" << 'BASHRC_EOF'
{bashrc_content}
BASHRC_EOF
    chmod 644 "$GLOBAL_PROFILE_SCRIPT"
    echo "  ✅ Global profile script created. Applies to all users (including root) on login."
fi


# ============================================================================
# Step 5: Configure sudo privileges
# ============================================================================
"""
    
    if enable_sudo:
        script += f"""echo "[5/6] Configuring sudo privileges..."
# Install sudo if not present
if ! command -v sudo &> /dev/null; then
    echo "  Installing sudo package..."
    if command -v apt-get &> /dev/null; then
        apt-get update -qq && apt-get install -y -qq sudo > /dev/null 2>&1
    elif command -v yum &> /dev/null; then
        yum install -y sudo > /dev/null 2>&1
    elif command -v apk &> /dev/null; then
        apk add --no-cache sudo > /dev/null 2>&1
    else
        echo "  ⚠️  Warning: Could not install sudo (package manager not found)"
    fi
fi

# Grant sudo privileges without password
if command -v sudo &> /dev/null; then
    echo "{username} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/{username}
    chmod 440 /etc/sudoers.d/{username}
    echo "  ✅ Sudo privileges granted (NOPASSWD)"
else
    echo "  ⚠️  Warning: sudo not available, skipping sudo configuration"
fi
"""
    else:
        script += """echo "[5/6] Skipping sudo configuration (disabled)"
"""

    # Step 6: Verify and start service
    script += f"""
# ============================================================================
# Step 6: Verify user setup
# ============================================================================
echo "[6/6] Verifying user setup..."
echo "  User info:"
id {username} | sed 's/^/    /'
echo "  Home directory:"
ls -ld {home_dir} | sed 's/^/    /'
"""

    if enable_sudo:
        script += f"""if [ -f /etc/sudoers.d/{username} ]; then
    echo "  Sudo config:"
    cat /etc/sudoers.d/{username} | sed 's/^/    /'
fi
"""

    script += """
echo ""
echo "=== User injection completed successfully ==="
echo ""

# ============================================================================
# Keep container running
# ============================================================================
"""

    if ssh_enabled:
        script += """# Start SSH service if available
if command -v sshd &> /dev/null; then
    echo "Starting SSH daemon..."

    # Generate host keys if they don't exist
    if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
        echo "  Generating SSH host keys..."
        ssh-keygen -A
    fi

    # Ensure /var/run/sshd directory exists
    mkdir -p /var/run/sshd

    # Start SSH in foreground mode
    echo "  Starting sshd in foreground mode..."
    /usr/sbin/sshd -D -e
else
    echo "⚠️  Warning: sshd not found in image"
    echo "Container will stay alive but SSH will not be available"
    tail -f /dev/null
fi
"""
    else:
        script += """echo "Keeping container alive..."
tail -f /dev/null
"""

    return script


def generate_user_injection_script_with_custom_bashrc(
    username: str,
    uid: int,
    gid: int,
    ssh_enabled: bool = True,
    enable_sudo: bool = True,
    additional_bashrc_config: Optional[str] = None,
) -> str:
    """
    Generate user injection script with custom .bashrc additions.

    Args:
        username: Username to create
        uid: User ID
        gid: Group ID
        ssh_enabled: Whether SSH is enabled
        enable_sudo: Whether to grant sudo privileges
        additional_bashrc_config: Additional .bashrc content to append

    Returns:
        str: Complete bash script for user injection
    """
    bashrc_content = generate_default_bashrc()

    if additional_bashrc_config:
        bashrc_content += "\n# ============ Custom Configuration ============\n"
        bashrc_content += additional_bashrc_config
        bashrc_content += "\n"

    return generate_user_injection_script(
        username=username,
        uid=uid,
        gid=gid,
        ssh_enabled=ssh_enabled,
        bashrc_content=bashrc_content,
        enable_sudo=enable_sudo,
    )


# ============================================================================
# Example custom .bashrc configurations
# ============================================================================

BASHRC_PYTHON_DEV = """
# Python development environment
export PYTHONPATH="${HOME}/projects:${PYTHONPATH}"
alias python=python3
alias pip=pip3
"""

BASHRC_CUDA_ENV = """
# CUDA environment
export CUDA_HOME=/usr/local/cuda
export PATH=${CUDA_HOME}/bin:${PATH}
export LD_LIBRARY_PATH=${CUDA_HOME}/lib64:${LD_LIBRARY_PATH}
"""

BASHRC_OPENCLAW = """
# OpenClaw environment
export OPENCLAW_HOME=${HOME}/openclaw
export PATH=${OPENCLAW_HOME}/bin:${PATH}

# Aliases for common tasks
alias openclaw-start='cd ${OPENCLAW_HOME} && ./start.sh'
alias openclaw-logs='tail -f ${OPENCLAW_HOME}/logs/*.log'
"""


if __name__ == "__main__":
    """
    Example usage and testing
    """
    print("=" * 80)
    print("User Injection Script Generator - Examples")
    print("=" * 80)
    print()

    # Example 1: Basic user injection
    print("Example 1: Basic user with sudo")
    print("-" * 80)
    script1 = generate_user_injection_script(
        username="user",
        uid=21927,
        gid=600,
        ssh_enabled=True,
        enable_sudo=True,
    )
    print(script1[:500] + "...\n")

    # Example 2: User with custom .bashrc
    print("Example 2: User with custom .bashrc (Python dev)")
    print("-" * 80)
    script2 = generate_user_injection_script_with_custom_bashrc(
        username="pyuser",
        uid=21927,
        gid=600,
        ssh_enabled=True,
        enable_sudo=True,
        additional_bashrc_config=BASHRC_PYTHON_DEV,
    )
    print(script2[:500] + "...\n")

    # Example 3: User for OpenClaw
    print("Example 3: User for OpenClaw environment")
    print("-" * 80)
    script3 = generate_user_injection_script_with_custom_bashrc(
        username="zdzhang",
        uid=21927,
        gid=600,
        ssh_enabled=True,
        enable_sudo=True,
        additional_bashrc_config=BASHRC_OPENCLAW + BASHRC_CUDA_ENV,
    )
    print(script3[:500] + "...\n")
