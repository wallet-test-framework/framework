mod http;
mod ws;

use crate::ws::Message;
use futures_util::stream::SplitSink;
use futures_util::SinkExt;
use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::json;
use std::fmt::{self, Debug};
use tokio::sync::mpsc::UnboundedReceiver;
use tokio::sync::Mutex;
use tokio::sync::MutexGuard;
use tokio::sync::OnceCell;
use tokio_tungstenite::tungstenite::Message as WsMessage;
use tokio_tungstenite::WebSocketStream;

#[tokio::main]
async fn main() {
    let ws_server = ws::Ws::serve().await;

    let handle = tokio::spawn(http::serve(ws_server));

    handle.await;
}
