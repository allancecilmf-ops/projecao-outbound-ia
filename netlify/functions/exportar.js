const SHEET_ID = "1nNwXnq-Fkyr_9kyNjNASZ7vL98-IKioKWcYbN11eK7s";
const SOURCES = {
  vendas: { gid: "1073865260", filename: "base-vendas.csv" },
  upgrade: { gid: "1040860114", filename: "base-upgrade.csv" },
  painel: { gid: "1641897951", filename: "dados-painel.csv" },
  chat: { gid: "1641897951", filename: "dados-chat.csv", transform: "chat" }
};

exports.handler = async event => {
  const tipo = String(event.queryStringParameters?.tipo || "").toLowerCase();
  const source = SOURCES[tipo];
  if (!source) return response(400, JSON.stringify({ error: "Tipo inválido. Use vendas, upgrade, painel ou chat." }), "application/json; charset=utf-8");
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${source.gid}`;
    const googleResponse = await fetch(url, { redirect: "follow" });
    if (!googleResponse.ok) throw new Error(`Google Planilhas respondeu HTTP ${googleResponse.status}`);
    let csv = await googleResponse.text();
    if (/^\s*<!doctype html/i.test(csv) || /accounts\.google\.com\/signin/i.test(csv)) throw new Error("A aba não está publicada para leitura externa");
    if (source.transform === "chat") csv = extractChatData(csv);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${source.filename}"`,
        "Cache-Control": "no-store"
      },
      body: "\ufeff" + csv
    };
  } catch (error) {
    return response(502, JSON.stringify({ error: "Não foi possível exportar os dados", detail: error.message }), "application/json; charset=utf-8");
  }
};

function response(statusCode, body, contentType) {
  return { statusCode, headers: { "Content-Type": contentType, "Cache-Control": "no-store" }, body };
}

function extractChatData(csv) {
  const table = parseCsv(csv), wanted = ["COMPETENCIA", "VENDAS CHAT", "UP VENDAS CHAT", "REGULARIZACAO VENDAS", "RENOVACAO VENDAS CHAT"];
  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  const headerIndex = table.findIndex(row => normalize(row[0]) === "COMPETENCIA" && wanted.filter(name => row.some(cell => normalize(cell) === name || normalize(cell).startsWith(name))).length >= 3);
  if (headerIndex < 0) throw new Error("Não encontrei as colunas de Vendas Chat na aba do painel");
  const header = table[headerIndex], positions = wanted.map(name => header.findIndex(cell => normalize(cell) === name || normalize(cell).startsWith(name)));
  const output = [["Competência", "Vendas Chat", "UP Vendas Chat", "Regularização Vendas", "Renovação Vendas Chat"]];
  for (const row of table.slice(headerIndex + 1)) if (/20\d{2}/.test(row[0] || "")) output.push(positions.map(index => index >= 0 ? row[index] || "" : ""));
  return output.map(row => row.map(csvCell).join(",")).join("\r\n");
}

function parseCsv(text) {
  const output=[];let row=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){const char=text[i];if(char==='"'&&text[i+1]==='"'){cell+='"';i++}else if(char==='"')quoted=!quoted;else if(char===','&&!quoted){row.push(cell);cell=""}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[i+1]==='\n')i++;row.push(cell);output.push(row);row=[];cell=""}else cell+=char}
  if(cell||row.length){row.push(cell);output.push(row)}return output;
}

function csvCell(value) {
  const text=String(value??"");return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
}
