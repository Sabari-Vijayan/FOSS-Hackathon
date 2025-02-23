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
let isScreenSharing = false;
let encryptionKey = null;

// Generate an AES encryption key
async function generateKey() {
  try {
    encryptionKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true, // Whether the key is extractable
      ["encrypt", "decrypt"] // Key usages
    );
    console.log("Encryption key generated successfully.");
  } catch (error) {
    console.error("Error generating encryption key:", error);
  }
}
// Encrypt message using AES
async function encryptMessage(message) {
  return CryptoJS.AES.encrypt(message, room).toString();
}
// Decrypt message using AES
async function decryptMessage(data) {
  const bytes = CryptoJS.AES.decrypt(data, room);
  return bytes.toString(CryptoJS.enc.Utf8); // Convert decrypted bytes to string
}

async function startScreenShare() {
  try {
    localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    document.getElementById("localVideo").srcObject = localStream;
    
    if (conn && conn.open) {
      const remotePeerId = conn.peer;
      const call = peer.call(remotePeerId, localStream, { metadata: { isScreenShare: true } });
      setupCall(call, true);
      isScreenSharing = true;
      document.getElementById("shareScreenButton").style.display = "none"; // Show End Call button
      document.getElementById("endScreenShareButton").style.display = "block"; // Hide Start Call button
    } else {
      logMessage("Remote connection not available for video call.", "system");
    }
  } catch (err) {
    console.error("Error starting video call:", err);
    logMessage("Error starting video call: " + err, "system");
  }
}
function endScreenShare() {

  if (isScreenSharing) {
    // Stop all tracks of the screen share stream.
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    // Close the screen share call if it's active.
    if (currentCall) {
      currentCall.close();
      currentCall = null;
    }
    // Reset the video element and flag.
    document.getElementById("localVideo").srcObject = null;
    document.getElementById("shareScreenButton").style.display = "block"; // Show End Call button
    document.getElementById("endScreenShareButton").style.display = "none"; // Hide Start Call button
    isScreenSharing = false;
    adjustShareLayout(false);
    logMessage("Screen sharing ended.", "system");
  } else {
    logMessage("No active screen share session to end.", "system");
  }
}

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
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    p.style.fontSize = type === "system" ? "35px" : "50px";
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
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    container.style.fontSize = type === "system" ? "35px" : "50px";
  }
}

function initHost() {
  const hostId = room + '-host';
  const peerConfig = {
    debug: 2, // Enables detailed logging for debugging purposes.
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" } // Google's free STUN server
      ]
    }
  };
  // peer = new Peer(hostId, { debug: 2 });
  peer = new Peer(hostId, peerConfig);
  
  peer.on('open', function(id) {
    console.log('Host peer open: ' + id);
    logMessage("Waiting for peer to join...", "system");
    
    // Set up host-specific event handlers.
    peer.on('connection', function(connection) {
      conn = connection;
      setupConnection();
    });
    peer.on('call', handleIncomingCallAsHost);
  });

  peer.on('error', function(err) {
    console.log('Peer error:', err);
    if (err.type === 'unavailable-id') {
      // Host already exists; switch to guest mode.
      initGuest();
    } else {
      logMessage("Peer error: " + err, "system");
    }
  });
}

// Guest initialization.
function initGuest() {
  const guestId = room + '-guest';
  peer = new Peer(guestId, { debug: 2 });
  
  peer.on('open', function(id) {
    console.log('Guest peer open: ' + id);
    logMessage("Connecting to host...", "system");
    conn = peer.connect(room + '-host');
    setupConnection();
    
    // Guest call handler: answer incoming calls without activating camera.
    peer.on('call', handleIncomingCallAsGuest);
  });
}

// Host-specific call handler.
function handleIncomingCallAsHost(call) {
  if (call.metadata && call.metadata.isScreenShare) {
    call.answer(); // Answer screen share calls without camera access.
    setupCall(call, true);
    adjustShareLayout(true);
  } else {
    // Answer without acquiring local media so that the guest's camera remains off.
    call.answer();
    setupCall(call, false);
  }
  document.getElementById("remoteVideo").style.display = "block"; // Show End Call button
}

// Guest-specific call handler.
function handleIncomingCallAsGuest(call) {
  if (call.metadata && call.metadata.isScreenShare) {
    call.answer(); // Answer screen share calls without camera access.
    setupCall(call, true);
    adjustShareLayout(true);
  } else {
    // Answer without acquiring local media so that the guest's camera remains off.
    call.answer();
    setupCall(call, false);
  }
  document.getElementById("remoteVideo").style.display = "block"; // Show End Call button
}

// Entry point: try to initialize as host first.
function initPeer() {
  initHost();
}

// Set up chat connection event handlers.
function setupConnection() {
  conn.on('open', function() {
    logMessage("Chat connection established.", "system");
  });
  conn.on('data', async function(data) {
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
    const decryptedMessage = await decryptMessage(data);
    // Otherwise, handle as a text message.

    logMessage(decryptedMessage, "received");
  });
  conn.on('error', function(err) {
    console.error("Connection error:", err);
    logMessage("Connection error: " + err, "system");
  });
  conn.on('close', function() {
    logMessage("Peer has disconnected.", "system");
  });
}

// Send a text message.
async function sendMessage() {
  const message = document.getElementById("messageInput").value;
  if (message.trim() === "") return;
  if (conn && conn.open) {
    const encrypted = await encryptMessage(message);
    console.log("Encrypted message:", encrypted);
    conn.send(encrypted);
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
    // Clear the file input.
    fileInput.value = "";
  }
  reader.readAsDataURL(file);
}

// Start a video call.
async function startVideoCall() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("localVideo").srcObject = localStream;
    
    if (conn && conn.open) {
      const remotePeerId = conn.peer;
      const call = peer.call(remotePeerId, localStream);
      setupCall(call);
      document.getElementById("localVideo").style.display = "block"; // Show End Call button
      adjustVideoLayout(true);
      document.getElementById("endCallButton").style.display = "block"; // Show End Call button
      document.getElementById("startCallButton").style.display = "none"; // Hide Start Call button
    } else {
      logMessage("Remote connection not available for video call.", "system");
    }
  } catch (err) {
    console.error("Error starting video call:", err);
    logMessage("Error starting video call: " + err, "system");
  }
}
// Stop a video call.
function endVideoCall() {
  if (currentCall) {
    currentCall.close();
    currentCall = null;
  }
  if (localStream) {
    // Stop all tracks in the local stream.
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
    document.getElementById("localVideo").srcObject = null;
    document.getElementById("remoteVideo").srcObject = null;
    adjustVideoLayout(false);
    document.getElementById("endCallButton").style.display = "none"; // Hide End Call button
    document.getElementById("startCallButton").style.display = "block"; // Show Start Call button
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

// Disconnect function to close chat connection, video call, and destroy peer.
function disconnect() {
  if (conn) {
    conn.close();
    conn = null;
  }
  if (currentCall) {
    currentCall.close();
    currentCall = null;
    logMessage("Video call ended.", "system");
  }
  if (peer && !peer.destroyed) {
    peer.destroy();
    // logMessage("Peer connection closed.", "system");
  }
}

// Event listeners.
document.getElementById("sendButton").addEventListener("click", sendMessage);
document.getElementById("messageInput").addEventListener("keydown", function(e) {
  if (e.key === "Enter") {
    sendMessage();
  }
});
// File button triggers file selection.
document.getElementById("fileButton").addEventListener("click", function() {
  document.getElementById("fileInput").click();
});
// When a file is selected, send it automatically.
document.getElementById("fileInput").addEventListener("change", sendFile);

document.getElementById("startCallButton").addEventListener("click", startVideoCall);
document.getElementById("endCallButton").addEventListener("click", endVideoCall);

document.getElementById("disconnectButton").addEventListener("click", disconnect);

document.getElementById("shareScreenButton").addEventListener("click", startScreenShare);
document.getElementById("endScreenShareButton").addEventListener("click", endScreenShare);

function adjustVideoLayout(isVideoCallActive) {
  const remoteVideo = document.getElementById("remoteVideo");
  const localVideo = document.getElementById("localVideo");

  if (isVideoCallActive) {
    remoteVideo.style.width = "90vw";
    remoteVideo.style.height = "90wh%";
    remoteVideo.style.objectFit = "cover";
    remoteVideo.style.transition = "all 0.5s ease-in-out"; 

    localVideo.style.width = "40vh";
    localVideo.style.height = "40vh";
    localVideo.style.objectFit = "cover";
    localVideo.style.transition = "all 0.5s ease-in-out"; 
  } else {
    remoteVideo.style.transition = "all 0.4s ease-in-out, opacity 0.4s ease-in-out";
    remoteVideo.style.width = "0%";  // Adjust to initial small size
    remoteVideo.style.height = "0%";
    remoteVideo.style.objectFit = "contain";

    localVideo.style.transition = "all 0.4s ease-in-out, opacity 0.4s ease-in-out";
    localVideo.style.width = "0%";  // Adjust to initial small size
    localVideo.style.height = "0%";
    localVideo.style.objectFit = "contain";
  }
}
function adjustShareLayout(isVideoCallActive) {
  const remoteVideo = document.getElementById("remoteVideo");

  if (isVideoCallActive) {
    remoteVideo.style.width = "85vw";
    remoteVideo.style.height = "85vh";
    remoteVideo.style.objectFit = "cover";
    remoteVideo.style.transition = "all 0.5s ease-in-out"; 
  } else {
    remoteVideo.style.transition = "all 0.5s ease-in-out";
    remoteVideo.style.width = "0%";  // Adjust to initial small size
    remoteVideo.style.height = "0%";
    remoteVideo.style.objectFit = "contain";
  }
}

function hideScreenShareButtonIfMobile() {
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    const chatDiv = document.getElementById("chat");
    document.getElementById("shareScreenButton").style.display = "none";
    document.getElementById("endScreenShareButton").style.display = "none";
    chatDiv.style.height = "70vh"; // Make chat cover full height on mobile
    chatDiv.style.width = "100%";
    document.body.style.fontSize = "37px"; // Increase base font size
    console.log("Screen sharing disabled on mobile devices.");
  }
  else {
    console.log("Screen sharing enabled on desktop.");
  }
}
document.addEventListener("DOMContentLoaded", hideScreenShareButtonIfMobile);

// Start the Peer connection.
initPeer();
