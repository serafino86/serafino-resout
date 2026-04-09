const API = {
  chatBot: async (payload) => {
    let res;
    try {
      res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (networkErr) {
      throw new Error(`Erreur réseau : ${networkErr.message}`);
    }
    let data;
    try { data = await res.json(); } catch { throw new Error('Réponse invalide du serveur'); }
    if (data.error && !data.reply) throw new Error(data.error);
    return data;
  },
};
