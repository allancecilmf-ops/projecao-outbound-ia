const SHEET_ID = "1nNwXnq-Fkyr_9kyNjNASZ7vL98-IKioKWcYbN11eK7s";
const DASHBOARD_GID = "1641897951";

exports.handler = async () => {
  try {
    const url =
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/` +
      `export?format=csv&gid=${DASHBOARD_GID}`;

    const response = await fetch(url, {
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error(
        `Google Planilhas respondeu HTTP ${response.status}`
      );
    }

    const csv = await response.text();

    if (
      /^\s*<!doctype html/i.test(csv) ||
      /accounts\.google\.com\/signin/i.test(csv)
    ) {
      throw new Error(
        "A aba do painel não está publicada para leitura externa"
      );
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Access-Control-Allow-Origin": "*"
      },
      body: csv
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        error: "Não foi possível carregar a aba do painel",
        detail: error.message
      })
    };
  }
};
