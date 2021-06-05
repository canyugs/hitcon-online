# Auth Server
## AuthServer.mjs
### 簡介
* 接收 POST request 夾帶的 token 參數，驗證 JWT，如果驗證成功就寫進 cookie 並跳轉到 client.html
* 單純驗證 JWT token 的有效性

### 使用方法
* 初始化
```
const authServer = AuthServer(app);
```

* 啟動 route
    * /auth: 接收 POST request，把 request 的 token 參數做 JWT 驗證，如果成功就寫進 cookie
    * /get\_test\_token: 取得測試 JWT token 字串，並寫進 cookie
```
authServer.run();
```

* 驗證 JWT token 字串
```
authServer.verifyToken(token);
```
