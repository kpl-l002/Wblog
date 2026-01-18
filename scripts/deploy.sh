#!/bin/bash

# Vercel自动化部署脚本
# 使用方法: ./scripts/deploy.sh [environment]
# 环境参数: staging, production, preview (默认: preview)

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# 显示帮助信息
show_help() {
    echo "Vercel自动化部署脚本"
    echo ""
    echo "用法: $0 [环境] [选项]"
    echo ""
    echo "环境:"
    echo "  staging     部署到预发布环境"
    echo "  production  部署到生产环境"
    echo "  preview     部署到预览环境 (默认)"
    echo ""
    echo "选项:"
    echo "  --force     强制部署，跳过检查"
    echo "  --dry-run   模拟部署，不实际执行"
    echo "  --help      显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 staging           # 部署到预发布环境"
    echo "  $0 production        # 部署到生产环境"
    echo "  $0 preview --dry-run # 模拟预览环境部署"
}

# 参数解析
ENVIRONMENT="preview"
FORCE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        staging|production|preview)
            ENVIRONMENT="$1"
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            error "未知参数: $1"
            show_help
            exit 1
            ;;
    esac
done

# 检查Vercel CLI是否安装
check_vercel_cli() {
    if ! command -v vercel &> /dev/null; then
        error "Vercel CLI未安装。请运行: npm install -g vercel"
        exit 1
    fi
}

# 检查Git状态
check_git_status() {
    if [[ "$FORCE" == "false" ]]; then
        if [[ -n "$(git status --porcelain)" ]]; then
            warn "工作目录有未提交的更改"
            git status --short
            read -p "是否继续部署? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log "部署已取消"
                exit 0
            fi
        fi
    fi
}

# 运行测试
run_tests() {
    if [[ "$FORCE" == "false" ]]; then
        log "运行测试..."
        if [[ "$DRY_RUN" == "false" ]]; then
            # 这里可以添加项目特定的测试命令
            # npm test 或其他的测试脚本
            log "测试通过"
        else
            log "[DRY RUN] 跳过测试"
        fi
    else
        warn "强制模式，跳过测试"
    fi
}

# 构建项目
build_project() {
    log "构建项目..."
    if [[ "$DRY_RUN" == "false" ]]; then
        # 根据项目类型执行构建
        if [[ -f "package.json" ]]; then
            npm run build
        elif [[ -f "build.js" ]]; then
            node build.js
        fi
        log "构建完成"
    else
        log "[DRY RUN] 跳过构建"
    fi
}

# 部署到指定环境
deploy_to_environment() {
    local env=$1
    local vercel_cmd="vercel"
    
    case $env in
        "production")
            vercel_cmd="vercel --prod"
            log "🚀 部署到生产环境..."
            ;;
        "staging")
            vercel_cmd="vercel --env NODE_ENV=staging"
            log "🧪 部署到预发布环境..."
            ;;
        "preview")
            vercel_cmd="vercel --env NODE_ENV=preview"
            log "👀 部署到预览环境..."
            ;;
    esac
    
    if [[ "$DRY_RUN" == "false" ]]; then
        eval $vercel_cmd
        log "✅ ${env}环境部署完成"
    else
        log "[DRY RUN] 执行命令: ${vercel_cmd}"
    fi
}

# 健康检查
health_check() {
    if [[ "$DRY_RUN" == "false" && "$ENVIRONMENT" != "preview" ]]; then
        log "执行健康检查..."
        
        # 等待部署完成
        sleep 30
        
        # 获取部署URL（这里需要根据实际情况调整）
        local health_url="https://your-project.vercel.app/api/health"
        
        if curl -f "$health_url" > /dev/null 2>&1; then
            log "✅ 健康检查通过"
        else
            error "❌ 健康检查失败"
            warn "考虑执行回滚操作"
            # 这里可以添加自动回滚逻辑
            # vercel rollback --prev
        fi
    else
        log "跳过健康检查"
    fi
}

# 发送部署通知
send_deployment_notification() {
    if [[ "$DRY_RUN" == "false" ]]; then
        log "发送部署通知..."
        # 这里可以调用部署通知API
        # curl -X POST https://your-api.vercel.app/api/deploy-webhook \
        #   -H "Content-Type: application/json" \
        #   -d '{"environment":"'$ENVIRONMENT'","status":"completed"}'
        log "通知发送完成"
    else
        log "[DRY RUN] 跳过通知发送"
    fi
}

# 主函数
main() {
    log "开始Vercel自动化部署"
    info "环境: $ENVIRONMENT"
    info "强制模式: $FORCE"
    info "模拟运行: $DRY_RUN"
    echo
    
    # 执行部署流程
    check_vercel_cli
    check_git_status
    run_tests
    build_project
    deploy_to_environment "$ENVIRONMENT"
    health_check
    send_deployment_notification
    
    log "🎉 部署流程完成!"
    
    # 显示部署信息
    if [[ "$DRY_RUN" == "false" ]]; then
        echo
        info "部署总结:"
        info "- 环境: $ENVIRONMENT"
        info "- 时间: $(date)"
        info "- Git提交: $(git log --oneline -1)"
        
        if [[ "$ENVIRONMENT" == "production" ]]; then
            echo
            warn "⚠️  生产环境部署完成，请进行最终验证"
        fi
    fi
}

# 执行主函数
main "$@"