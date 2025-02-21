const messageInput = document.querySelector('.message-input input');
const sendButton = document.querySelector('.message-input button');
const messagesContainer = document.querySelector('.messages');

sendButton.addEventListener('click', () => {
  const messageText = messageInput.value.trim();
  if (messageText) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'sent');
    messageElement.textContent = messageText;
    messagesContainer.appendChild(messageElement);
    messageInput.value = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
});