const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: cors(),
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, {
      error: "Método não permitido"
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return json(500, {
      error: "GEMINI_API_KEY não foi configurada no Netlify"
    });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const question = String(body.question || "").trim().slice(0, 1500);
    const context = body.context;

    if (!question) {
      return json(400, {
        error: "Pergunta não informada"
      });
    }

    if (!context || typeof context !== "object") {
      return json(400, {
        error: "Contexto da base não informado"
      });
    }

    const prompt = `Você é um analista executivo de operações da Concentrix. Responda em português do Brasil.

Use SOMENTE os dados estruturados recebidos. Não invente valores, pessoas, causas ou metas ausentes.

Respeite obrigatoriamente a origem dos dados:
- Vendas vem exclusivamente da base Vendas.
- Upgrade vem exclusivamente da base Upgrade.
- Metas, projeções, distribuições e problemas sistêmicos vêm do extrato do painel.

"Concorrente" significa exclusivamente os registros cuja coluna EPS contém Pessoalize.

Para comparar filiais de Vendas, compare:
- EPS Pessoalize;
- Segmento Vendas CWB;
- Segmento Vendas SP.

A análise da Pessoalize deve considerar Vendas e Upgrade separadamente e somente registros com:
- Rep Vendas preenchido na base Vendas;
- Login preenchido na base Upgrade.

Não use País, Segmento, EPS ou outro campo como nome de pessoa.

A competência vigente é o padrão. Só use competência anterior quando ela estiver explícita na pergunta e aparecer em competenciaAplicada.

Os totais representam registros encontrados nas bases operacionais.

Sempre chame NR Smiles de "número de membro" nas respostas ao usuário.

Rankings de agentes devem contar exclusivamente nomes preenchidos na coluna Agente.

Nunca inclua no ranking:
- BRASIL;
- ARGENTINA;
- Não informado;
- País;
- EPS;
- Segmento.

Quando a consulta for específica da Pessoalize, use Rep Vendas ou Login como responsável, pois a coluna Agente pode estar vazia nessa EPS.

Quando a pergunta mencionar PAs da Pessoalize, use:
- quantidades distintas de Rep Vendas em Vendas;
- quantidades distintas de Login em Upgrade.

Quando a pergunta usar "ontem", respeite a data exata calculada pelo JavaScript como hoje menos um dia.

Para Upgrade, a data de referência é sempre a coluna A, dt_solicitacao.

Quando houver exclusão de plano, como "não foi 1.000", respeite o filtro e não recoloque o plano excluído na análise.

Faça uma análise objetiva, fácil de ler e focada em:
- concentração;
- diferenças relevantes;
- evolução por data;
- pontos de atenção sustentados pelos números;
- oportunidades;
- recomendações práticas.

Use problemasSistemicos para enriquecer o resumo quando houver conteúdo, sem presumir impacto ou causalidade não demonstrada.

Quando os dados não forem suficientes para responder com segurança, peça ao usuário que reformule informando:
- operação;
- filial ou EPS;
- período;
- agrupamento desejado.

Apresente no máximo 8 tópicos e finalize com uma conclusão curta.

PERGUNTA:
${question}

DADOS CALCULADOS PELO JAVASCRIPT:
${JSON.stringify(context)}`;

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(MODEL)}:generateContent`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 2400,
          thinkingConfig: {
            thinkingLevel: "minimal",
            includeThoughts: false
          }
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      const message =
        result?.error?.message ||
        `Gemini respondeu HTTP ${response.status}`;

      return json(response.status === 429 ? 429 : 502, {
        error: message
      });
    }

    const parts = result?.candidates?.[0]?.content?.parts || [];

    const answer = parts
      .filter(part => part.thought !== true)
      .map(part => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      return json(502, {
        error: "O Gemini retornou uma resposta vazia"
      });
    }

    return json(200, {
      answer,
      model: MODEL
    });
  } catch (error) {
    return json(500, {
      error: "Falha ao processar a análise",
      detail: error.message
    });
  }
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      ...cors(),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}
