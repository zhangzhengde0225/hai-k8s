# OpenClaw Environment Configuration
# This file is automatically sourced by .bashrc

# ============================================================================
# OpenClaw Configuration
# ============================================================================
export PATH="/app/node_modules/.bin:$PATH"

alias ocl='openclaw'
alias ocl-models='openclaw models list'
alias ocl-send='openclaw send'
alias ocl-gateway='openclaw gateway run --bind lan --port 18789'
alias ocl-pm2='pm2 start openclaw --name gateway -- gateway run --bind lan --port 18789'


# ============================================================================
# Welcome Message
# ============================================================================
echo ""
echo "🚀 Welcome to HAI-K8S OpenClaw Environment"
echo "   User: $(whoami)"
echo "   Home: ${HOME}"
echo ""
echo "📚 Quick Commands:"
echo "   openclaw                                      - Show OpenClaw CLI help"
echo "   openclaw models list                          - List available OpenClaw models"
echo "   openclaw gateway run --bind lan --port 18789  - Run OpenClaw Gateway"
echo ""
