use crate::ws::Ws;
use hyper::service::make_service_fn;
use hyper::service::service_fn;
use hyper::Body;
use hyper::Request;
use hyper::Response;
use hyper::Server;
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;
use std::ffi::OsStr;
use std::path::PathBuf;

const INDEX_HTML: &str = include_str!("www/index.html");

pub async fn serve(ws_server: Ws) {
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    let ws = Arc::new(ws_server);

    let make_svc = make_service_fn(|_conn| {
        let clone = ws.clone();
        async move { Ok::<_, Infallible>(service_fn(move |req| on_request(clone.clone(), req))) }
    });

    let server = Server::bind(&addr).serve(make_svc);

    if let Err(e) = server.await {
        eprintln!("server error: {}", e);
    }
}

async fn on_request(
    ws_server: Arc<Ws>,
    mut req: Request<Body>,
) -> Result<Response<Body>, Infallible> {
    match req.uri().path() {
        "/" | "/index.html" => Ok(Response::new(INDEX_HTML.into())),
        path if path.starts_with("/static/") => {
            let path = path.strip_prefix("/static/").unwrap();
            let mut root = PathBuf::new();
            root.push("..");
            root.push("wallet-tests");
            root.push("dist");

            let root_canon = tokio::fs::canonicalize(&root).await.unwrap();
            let path = root.join(path);
            let path_canon = tokio::fs::canonicalize(&path).await.unwrap();
            if !path_canon.starts_with(&root_canon) {
                panic!("Invalid Path");
            }
            let contents = tokio::fs::read(&path_canon).await.unwrap();

            let mut resp = Response::builder();

            if path_canon.extension().and_then(OsStr::to_str) == Some("js") {
                resp = resp.header("Content-Type", "text/javascript");
            }
            Ok(resp.body(contents.into()).unwrap())
        }
        path if path.starts_with("/rpc/") => {
            let addr: SocketAddr = path.strip_prefix("/rpc/").unwrap().parse().unwrap();
            let body = hyper::body::to_bytes(req.body_mut()).await.unwrap();
            let value: serde_json::Value = serde_json::from_slice(&body).unwrap();
            let response = ws_server.send(addr, value).await;
            Ok(Response::new(
                serde_json::to_string(&response).unwrap().into(),
            ))
        }
        _ => Ok(Response::builder().status(404).body("".into()).unwrap()),
    }
}
