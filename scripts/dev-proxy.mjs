export function loopbackDevBoundary(){
  return {name:'whiteboard-local-dev-boundary',configureServer(server){
    server.middlewares.use((req,res,next)=>{
      if(!req.url?.startsWith('/api'))return next();
      const address=server.httpServer?.address();
      const port=typeof address==='object'&&address?address.port:server.config.server.port;
      const allowedHosts=[`127.0.0.1:${port}`,`localhost:${port}`];
      if(!allowedHosts.includes(req.headers.host)||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){
        res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'拒绝跨站访问'}));return;
      }
      next();
    });
  }};
}

export function whiteboardDevProxy(target){
  const origin=new URL(target).origin;
  return {target,changeOrigin:true,configure(proxy){
    // The middleware above has already checked the original browser origin.
    proxy.on('proxyReq',(proxyReq,req)=>{if(req.headers.origin)proxyReq.setHeader('Origin',origin);});
  }};
}
