// Sub-agent to respond to /sales command with sales-related replies

module.exports = async function handleSalesCommand(context = {}) {
  const { command, message = {}, sendMessage } = context;
  const text = (message.text || '').trim();

  // Supports either explicit parsed command or raw message text
  if (command !== '/sales' && !text.startsWith('/sales')) {
    return false;
  }

  // Optional mini-intent parsing: /sales, /sales pitch, /sales followup, /sales objection, /sales close
  const argString = text.replace('/sales', '').trim().toLowerCase();

  const replies = {
    default:
      '📈 Sales Assistant Ready!\n\n' +
      'Try one of these:\n' +
      '• /sales pitch – quick value pitch\n' +
      '• /sales followup – polite follow-up template\n' +
      '• /sales objection – handle common objections\n' +
      '• /sales close – closing message template',

    pitch:
      'Here’s a concise pitch template:\n\n' +
      '"Hi [Name], we help [target customer] achieve [key outcome] by [unique approach]. ' +
      'Teams like yours usually see [specific benefit] in [timeframe]. ' +
      'Would you be open to a quick 15-minute walkthrough this week?"',

    followup:
      'Follow-up template:\n\n' +
      '"Hi [Name], just checking in on my last note about helping [company] with [outcome]. ' +
      'If this is relevant, I can share a short plan tailored to your goals. ' +
      'Would Tuesday or Thursday work for a quick chat?"',

    objection:
      'Objection-handling template:\n\n' +
      '"That makes sense — many teams felt the same at first. ' +
      'What changed their mind was seeing how we reduced [pain point] while improving [result]. ' +
      'If useful, I can show a brief example based on your use case."',

    close:
      'Closing template:\n\n' +
      '"Based on what you shared, the best next step is [proposal]. ' +
      'If you’re happy to proceed, I can send a simple summary and kickoff timeline today. ' +
      'Shall I get that over to you?"'
  };

  const key = ['pitch', 'followup', 'objection', 'close'].find((k) => argString.startsWith(k)) || 'default';
  const reply = replies[key];

  if (typeof sendMessage === 'function') {
    await sendMessage(reply);
    return true;
  }

  // Fallback for frameworks expecting returned payload
  return { reply };
};
