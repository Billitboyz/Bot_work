// Sub-agent responding to /coder command
module.exports = async function (params) {
  // Check if the message is the /coder command
  if (params.message && params.message.text === '/coder') {
    return {
      reply: 'Hello! I am your coding assistant. How can I help you with your coding today? Feel free to ask me about programming, debugging, or coding concepts.'
    };
  }
  // Default reply for unrecognized messages
  return {
    reply: 'I only respond to /coder command. Please type /coder to start.'
  };
};
