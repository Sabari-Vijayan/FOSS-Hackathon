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
let localStream = null;
let currentCall = null; // To track an active video call

// Log a message to the chat with a given type: "sent", "received", or "system".
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

// Helper to append a DOM element in a styled container.
function appendChatElement(element, type) {
  const container = document.createElement("div");
  if (type === "sent") {
    container.classList.add("sent");
  } else if (type === "received") {
    container.classList.add("received");
  } else {
    container.classList.add("system");
  }
  container.appendChild(element);
  const chatDiv = document.getElementById("chat");
  chatDiv.appendChild(container);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

// Initialize the Peer connection.
function initPeer() {
  // Attempt to be the host using a fixed ID based on the room.
  peer = new Peer(room + '-host', { debug: 2 });

  peer.on('open', function(id) {
    console.log('Host peer open: ' + id);
    logMessage("Waiting for peer to join...", "system");
  });

  // If the host ID is unavailable, switch to guest mode.
  peer.on('error', function(err) {
    console.log('Peer error:', err);
    if (err.type === 'unavailable-id') {
      // Host already exists; become the guest.
      peer = new Peer(room + '-guest', { debug: 2 });
      peer.on('open', function(id) {
        console.log('Guest peer open: ' + id);
        logMessage("Connecting to host...", "system");
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

  // Handle incoming video calls.
  peer.on('call', async function(call) {
    if (!localStream) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById("localVideo").srcObject = localStream;
      } catch (err) {
        console.error("Error accessing media devices:", err);
        logMessage("Error accessing media devices: " + err, "system");
        return;
      }
    }
    call.answer(localStream);
    setupCall(call);
  });
}

// Set up chat connection event handlers.
function setupConnection() {
  conn.on('open', function() {
    logMessage("Chat connection established.", "system");
  });
  conn.on('data', function(data) {
    // If data is an object with a file property, treat it as a file message.
    if (typeof data === "object" && data.file) {
      if (data.fileType && data.fileType.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = data.file;
        img.alt = data.fileName;
        img.classList.add("received-file");
        appendChatElement(img, "received");
      } else {
        const link = document.createElement("a");
        link.href = data.file;
        link.download = data.fileName;
        link.textContent = "Download " + data.fileName;
        appendChatElement(link, "received");
      }
      return;
    }
    // Otherwise, handle as a text message.
    logMessage(data, "received");
  });
  conn.on('error', function(err) {
    console.error("Connection error:", err);
    logMessage("Connection error: " + err, "system");
  });
}

// Send a text message.
function sendMessage() {
  const message = document.getElementById("messageInput").value;
  if (message.trim() === "") return;
  if (conn && conn.open) {
    conn.send(message);
    logMessage(message, "sent");
    document.getElementById("messageInput").value = "";
  } else {
    logMessage("Connection not open yet.", "system");
  }
}

// Send a file (or image).
function sendFile() {
  const fileInput = document.getElementById("fileInput");
  if (fileInput.files.length === 0) return;
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const fileData = e.target.result;
    const payload = {
      file: fileData,
      fileName: file.name,
      fileType: file.type
    };
    if (conn && conn.open) {
      conn.send(payload);
      // Display the sent file in chat.
      if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = fileData;
        img.alt = file.name;
        img.classList.add("sent-file");
        appendChatElement(img, "sent");
      } else {
        const link = document.createElement("a");
        link.href = fileData;
        link.download = file.name;
        link.textContent = "Download " + file.name;
        appendChatElement(link, "sent");
      }
    } else {
      logMessage("Connection not open yet.", "system");
    }
  }
  reader.readAsDataURL(file);
}

// Start a video call.
async function startVideoCall() {
  if (currentCall) {
    logMessage("Video call already in progress.", "system");
    return;
  }
  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("localVideo").srcObject = localStream;
    
    if (conn && conn.open) {
      const remotePeerId = conn.peer;
      const call = peer.call(remotePeerId, localStream);
      setupCall(call);
    } else {
      logMessage("Remote connection not available for video call.", "system");
    }
  } catch (err) {
    console.error("Error starting video call:", err);
    logMessage("Error starting video call: " + err, "system");
  }
}

// Set up a video call.
function setupCall(call) {
  currentCall = call;
  
  call.on('stream', function(remoteStream) {
    document.getElementById("remoteVideo").srcObject = remoteStream;
  });
  
  call.on('close', function() {
    logMessage("Video call ended.", "system");
    currentCall = null;
  });
  
  call.on('error', function(err) {
    console.error("Call error:", err);
    logMessage("Call error: " + err, "system");
  });
}

// Event listeners.
document.getElementById("sendButton").addEventListener("click", sendMessage);
document.getElementById("messageInput").addEventListener("keydown", function(e) {
  if (e.key === "Enter") {
    sendMessage();
  }
});
document.getElementById("sendFileButton").addEventListener("click", sendFile);
document.getElementById("startCallButton").addEventListener("click", startVideoCall);

// Start the Peer connection.
initPeer();
