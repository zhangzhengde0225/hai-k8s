

# ============================================================================
# General Content for HaiK8s User's .bashrc
# ============================================================================
export PS1="\[\033[01;35m\][\[\033[00m\]\[\033[01;32m\]\u@\h\[\033[00m\] \[\033[01;34m\]\W\[\033[00m\]\[\033[01;35m\]]\[\033[00m\]\$ "

if command -v dircolors > /dev/null 2>&1; then
    eval "$(dircolors -b)"
    alias ls='ls --color=auto'
    alias grep='grep --color=auto'
fi

alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'

