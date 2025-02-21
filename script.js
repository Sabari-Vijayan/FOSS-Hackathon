// Get or generate the room ID from the URL query parameter.
const urlParams = new URLSearchParams(window.location.search);
let room = urlParams.get("room");
if (!room) {
  room = Math.random().toString(36).substr(2, 6);
  const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?room=' + room;
  window.history.pushState({ path: newUrl }, '', newUrl);
}
document.getElementById("room-id").textContent = room;

let peer;
let conn;

// Log messages to the chat div with a type: "sent", "received", or "system".
function logMessage(msg, type = "system") {
  const p = document.createElement("p");
  p.textContent = msg;
  if (type === "sent") {
    p.classList.add("sent");
  } else if (type === "received") {
    p.classList.add("received");
  } else {
    p.classList.add("system");
  }
  const chatDiv = document.getElementById("chat");
  chatDiv.appendChild(p);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

// Initialize the Peer connection.
function initPeer() {
  // Try to become the host using a fixed ID based on the room.
  peer = new Peer(room + '-host', { debug: 2 });

  peer.on('open', function(id) {
    console.log('Host peer open: ' + id);
    logMessage("Waiting for peer to join...", "system");
  });

  // If the host ID is already taken, switch to become the guest.
  peer.on('error', function(err) {
    console.log('Peer error:', err);
    if (err.type === 'unavailable-id') {
      // Host already exists, so become the guest.
      peer = new Peer(room + '-guest', { debug: 2 });
      peer.on('open', function(id) {
        console.log('Guest peer open: ' + id);
        logMessage("Connecting to host...", "system");
        // Connect to the host.
        conn = peer.connect(room + '-host');
        setupConnection();
      });
    } else {
      logMessage("Peer error: " + err, "system");
    }
  });

  // For host: when a connection is received, set it up.
  peer.on('connection', function(connection) {
    conn = connection;
    setupConnection();
  });
}

// Set up data channel event handlers.
function setupConnection() {
  conn.on('open', function() {
    logMessage("Connection established.", "system");
  });
  conn.on('data', function(data) {
    logMessage(data, "received");
  });
  conn.on('error', function(err) {
    console.error("Connection error:", err);
    logMessage("Connection error: " + err, "system");
  });
}

// Send a chat message when the button is clicked.
document.getElementById("sendButton").addEventListener("click", function() {
  const message = document.getElementById("messageInput").value;
  if (conn && conn.open) {
    conn.send(message);
    logMessage(message, "sent");
    document.getElementById("messageInput").value = "";
  } else {
    logMessage("Connection not open yet.", "system");
  }
});

// Start the peer initialization.
initPeer();
