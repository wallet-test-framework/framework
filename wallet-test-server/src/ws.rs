use futures_util::stream::SplitSink;
use futures_util::SinkExt;
use futures_util::StreamExt;
use futures_util::TryStreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::future;
use std::net::SocketAddr;
use std::sync::Arc;
use std::sync::Weak;
use tokio::net::TcpListener;
use tokio::net::TcpStream;
use tokio::sync::mpsc::unbounded_channel;
use tokio::sync::mpsc::UnboundedReceiver;
use tokio::sync::mpsc::UnboundedSender;
use tokio::sync::oneshot;
use tokio::sync::Mutex;
use tokio_tungstenite::tungstenite::Message as WsMessage;
use tokio_tungstenite::WebSocketStream;

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "kind", content = "body", rename_all = "snake_case")]
pub enum Message {
    Open(String),
    Request {
        call: serde_json::Value,
        number: u32,
    },
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "kind", content = "body", rename_all = "snake_case")]
pub enum MessageReply {
    Reply {
        result: serde_json::Value,
        number: u32,
    },
}

struct Connection {
    write:
        SplitSink<WebSocketStream<tokio::net::TcpStream>, tokio_tungstenite::tungstenite::Message>,
    number: u32,
    replies: HashMap<u32, oneshot::Sender<serde_json::Value>>,
}

pub struct Ws {
    connections: Arc<Mutex<HashMap<SocketAddr, Connection>>>,
}

impl Ws {
    pub async fn serve() -> Self {
        let connections: Arc<Mutex<HashMap<SocketAddr, Connection>>> = Default::default();
        let addr = SocketAddr::from(([127, 0, 0, 1], 3001));
        let try_socket = TcpListener::bind(&addr).await;
        let listener = try_socket.expect("Failed to bind");
        println!("Listening on: {}", addr);

        let connections_clone = connections.clone();

        tokio::spawn(async move {
            while let Ok((stream, addr)) = listener.accept().await {
                let write =
                    Self::accept_connection(Arc::downgrade(&connections_clone), stream).await;
                let connection = Connection {
                    write,
                    number: 0,
                    replies: Default::default(),
                };
                connections_clone.lock().await.insert(addr, connection);
            }
        });

        Self { connections }
    }

    pub async fn send(&self, addr: SocketAddr, value: serde_json::Value) -> serde_json::Value {
        let mut connections = self.connections.lock().await;
        let connection = connections.get_mut(&addr).unwrap();

        let (sender, receiver) = oneshot::channel();
        let number = connection.number;
        connection.number += 1;

        connection.replies.insert(number, sender);

        let msg = Message::Request {
            call: value,
            number,
        };

        let text = serde_json::to_string(&msg).unwrap();

        connection.write.send(WsMessage::Text(text)).await.unwrap();
        drop(connections);

        receiver.await.unwrap()
    }

    async fn accept_connection(
        connections: Weak<Mutex<HashMap<SocketAddr, Connection>>>,
        stream: TcpStream,
    ) -> SplitSink<WebSocketStream<tokio::net::TcpStream>, tokio_tungstenite::tungstenite::Message>
    {
        let addr = stream
            .peer_addr()
            .expect("connected streams should have a peer address");
        println!("Peer address: {}", addr);

        let ws_stream = tokio_tungstenite::accept_async(stream)
            .await
            .expect("Error during the websocket handshake occurred");

        println!("New WebSocket connection: {}", addr);

        let (mut write, read) = ws_stream.split();

        let open = serde_json::to_string(&Message::Open(format!("/rpc/{}", addr))).unwrap();
        write.send(WsMessage::Text(open)).await.unwrap();

        let mut stream = read.try_filter(|msg| future::ready(msg.is_text() || msg.is_binary()));
        tokio::spawn(async move {
            while let Some(json) = stream.next().await {
                let msg: MessageReply = match json.unwrap() {
                    WsMessage::Text(txt) => serde_json::from_str(&txt).unwrap(),
                    WsMessage::Binary(b) => serde_json::from_slice(&b).unwrap(),
                    _ => continue,
                };

                match msg {
                    MessageReply::Reply { number, result } => {
                        let connections_arc = connections.upgrade().unwrap();
                        let mut connections = connections_arc.lock().await;
                        let connection = connections.get_mut(&addr).unwrap();
                        let sender = connection.replies.remove(&number).unwrap();
                        sender.send(result).unwrap();
                    }
                }
            }
        });

        write
    }
}
