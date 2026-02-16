// Sub-agent to respond to /bb command with BILLIT message

module.exports = async function handleCommand(context) {
  const { command, sendMessage } = context;
  if (command === '/bb') {
    const responseText = 'BILLIT\n\n' + 'Response to /bb command';
    await sendMessage(responseText);
    return true;
  }
  return false;
};
