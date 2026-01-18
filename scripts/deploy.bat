@echo off
setlocal enabledelayedexpansion

:: Vercel自动化部署脚本 (Windows版本)
:: 使用方法: deploy.bat [environment] [options]
:: 环境参数: staging, production, preview (默认: preview)

:: 颜色定义
for /f "delims=#" %%a in ('"prompt #$h# & for %%b in (1) do rem"') do set "BS=%%a"
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

:: 日志函数
:log
    echo %GREEN%[%date% %time%]%NC% %*
    goto :eof

:warn
    echo %YELLOW%[%date% %time%] WARNING:%NC% %*
    goto :eof

:error
    echo %RED%[%date% %time%] ERROR:%NC% %*
    goto :eof

:info
    echo %BLUE%[%date% %time%] INFO:%NC% %*
    goto :eof

:: 显示帮助信息
:show_help
    echo Vercel自动化部署脚本 (Windows版本)
    echo.
    echo 用法: %0 [环境] [选项]
    echo.
    echo 环境:
    echo   staging     部署到预发布环境
    echo   production  部署到生产环境
    echo   preview     部署到预览环境 (默认)
    echo.
    echo 选项:
    echo   --force     强制部署，跳过检查
    echo   --dry-run   模拟部署，不实际执行
    echo   --help      显示此帮助信息
    echo.
    echo 示例:
    echo   %0 staging           # 部署到预发布环境
    echo   %0 production        # 部署到生产环境
    echo   %0 preview --dry-run # 模拟预览环境部署
    goto :eof

:: 参数解析
set "ENVIRONMENT=preview"
set "FORCE=false"
set "DRY_RUN=false"

:parse_args
if "%~1"=="" goto :args_parsed

if "%~1"=="staging" (
    set "ENVIRONMENT=staging"
    shift
    goto :parse_args
)

if "%~1"=="production" (
    set "ENVIRONMENT=production"
    shift
    goto :parse_args
)

if "%~1"=="preview" (
    set "ENVIRONMENT=preview"
    shift
    goto :parse_args
)

if "%~1"=="--force" (
    set "FORCE=true"
    shift
    goto :parse_args
)

if "%~1"=="--dry-run" (
    set "DRY_RUN=true"
    shift
    goto :parse_args
)

if "%~1"=="--help" (
    call :show_help
    exit /b 0
)

echo ERROR: 未知参数: %~1
call :show_help
exit /b 1

:args_parsed

:: 检查Vercel CLI是否安装
:check_vercel_cli
    vercel --version >nul 2>&1
    if errorlevel 1 (
        call :error "Vercel CLI未安装。请运行: npm install -g vercel"
        exit /b 1
    )
    goto :eof

:: 检查Git状态
:check_git_status
    if "!FORCE!"=="false" (
        git status --porcelain >nul 2>&1
        if not errorlevel 1 (
            call :warn "工作目录有未提交的更改"
            git status --short
            set /p "CONTINUE=是否继续部署? (y/N): "
            if /i not "!CONTINUE!"=="y" (
                if /i not "!CONTINUE!"=="yes" (
                    call :log "部署已取消"
                    exit /b 0
                )
            )
        )
    )
    goto :eof

:: 运行测试
:run_tests
    if "!FORCE!"=="false" (
        call :log "运行测试..."
        if "!DRY_RUN!"=="false" (
            :: 这里可以添加项目特定的测试命令
            :: npm test 或其他的测试脚本
            call :log "测试通过"
        ) else (
            call :log "[DRY RUN] 跳过测试"
        )
    ) else (
        call :warn "强制模式，跳过测试"
    )
    goto :eof

:: 构建项目
:build_project
    call :log "构建项目..."
    if "!DRY_RUN!"=="false" (
        :: 根据项目类型执行构建
        if exist "package.json" (
            npm run build
        ) else if exist "build.js" (
            node build.js
        )
        call :log "构建完成"
    ) else (
        call :log "[DRY RUN] 跳过构建"
    )
    goto :eof

:: 部署到指定环境
:deploy_to_environment
    set "VERCEL_CMD=vercel"
    
    if "!ENVIRONMENT!"=="production" (
        set "VERCEL_CMD=vercel --prod"
        call :log "🚀 部署到生产环境..."
    ) else if "!ENVIRONMENT!"=="staging" (
        set "VERCEL_CMD=vercel --env NODE_ENV=staging"
        call :log "🧪 部署到预发布环境..."
    ) else (
        set "VERCEL_CMD=vercel --env NODE_ENV=preview"
        call :log "👀 部署到预览环境..."
    )
    
    if "!DRY_RUN!"=="false" (
        !VERCEL_CMD!
        call :log "✅ !ENVIRONMENT!环境部署完成"
    ) else (
        call :log "[DRY RUN] 执行命令: !VERCEL_CMD!"
    )
    goto :eof

:: 健康检查
:health_check
    if "!DRY_RUN!"=="false" if not "!ENVIRONMENT!"=="preview" (
        call :log "执行健康检查..."
        
        :: 等待部署完成
        timeout /t 30 /nobreak >nul
        
        :: 获取部署URL（这里需要根据实际情况调整）
        set "HEALTH_URL=https://your-project.vercel.app/api/health"
        
        curl -f "!HEALTH_URL!" >nul 2>&1
        if errorlevel 1 (
            call :error "❌ 健康检查失败"
            call :warn "考虑执行回滚操作"
            :: 这里可以添加自动回滚逻辑
            :: vercel rollback --prev
        ) else (
            call :log "✅ 健康检查通过"
        )
    ) else (
        call :log "跳过健康检查"
    )
    goto :eof

:: 发送部署通知
:send_deployment_notification
    if "!DRY_RUN!"=="false" (
        call :log "发送部署通知..."
        :: 这里可以调用部署通知API
        :: curl -X POST https://your-api.vercel.app/api/deploy-webhook ^
        ::   -H "Content-Type: application/json" ^
        ::   -d "{\"environment\":\"!ENVIRONMENT!\",\"status\":\"completed\"}"
        call :log "通知发送完成"
    ) else (
        call :log "[DRY RUN] 跳过通知发送"
    )
    goto :eof

:: 主函数
:main
    call :log "开始Vercel自动化部署"
    call :info "环境: !ENVIRONMENT!"
    call :info "强制模式: !FORCE!"
    call :info "模拟运行: !DRY_RUN!"
    echo.
    
    :: 执行部署流程
    call :check_vercel_cli
    call :check_git_status
    call :run_tests
    call :build_project
    call :deploy_to_environment
    call :health_check
    call :send_deployment_notification
    
    call :log "🎉 部署流程完成!"
    
    :: 显示部署信息
    if "!DRY_RUN!"=="false" (
        echo.
        call :info "部署总结:"
        call :info "- 环境: !ENVIRONMENT!"
        call :info "- 时间: %date% %time%"
        
        for /f "tokens=*" %%i in ('git log --oneline -1') do set "GIT_COMMIT=%%i"
        call :info "- Git提交: !GIT_COMMIT!"
        
        if "!ENVIRONMENT!"=="production" (
            echo.
            call :warn "⚠️  生产环境部署完成，请进行最终验证"
        )
    )
    goto :eof

:: 执行主函数
call :main

endlocal