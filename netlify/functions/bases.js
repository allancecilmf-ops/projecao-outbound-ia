const SHEET_ID = "1nNwXnq-Fkyr_9kyNjNASZ7vL98-IKioKWcYbN11eK7s";
const GIDS = ["1073865260", "1040860114"];

exports.handler = async () => {
  try {
    const urls = GIDS.map(gid =>
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`
    );

    const responses = await Promise.all(
      urls.map(url => fetch(url, { redirect: "follow" }))
    );

    const failed = responses.find(response => !response.ok);

    if (failed) {
      throw new Error(`Google Planilhas respondeu HTTP ${failed.status}`);
    }

    const csvs = await Promise.all(
      responses.map(response => response.text())
    );

    if (
      csvs.some(
        csv =>
          /^\s*<!doctype html/i.test(csv) ||
          /accounts\.google\.com\/signin/i.test(csv)
      )
    ) {
      throw new Error("As abas não estão publicadas para leitura externa");
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Access-Control-Allow-Origin": "*"
      },
      body: csvs.join("\n")
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        error: "Não foi possível carregar as bases",
        detail: error.message
      })
    };
  }
};
