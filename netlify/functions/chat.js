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
    const question = String(body.question || "")
      .trim()
      .slice(0, 1500);

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

Respeite a origem dos dados:
- Vendas vem da base Vendas;
- Upgrade vem da base Upgrade;
- metas, projeções, distribuições e problemas sistêmicos vêm do extrato do painel.

"Concorrente" significa exclusivamente os registros cuja coluna EPS contém Pessoalize. Para comparar filiais de Vendas, compare EPS Pessoalize, segmento Vendas CWB e segmento Vendas SP.

A análise da Pessoalize deve considerar Vendas e Upgrade separadamente e somente registros com Rep Vendas (base Vendas) ou Login (base Upgrade) preenchido. Não use País, Segmento ou outro campo como nome de pessoa.

A Pessoalize e a coluna EPS só podem ser utilizadas quando a pergunta mencionar explicitamente "Pessoalize" ou "concorrente".

Nos comandos "Resumo conclusivo da competência vigente" e "Pontos de atenção e plano de ação", é proibido mencionar Pessoalize, concorrente ou resultados por EPS, mesmo que esses dados existam em outro contexto.

No "Resumo conclusivo da competência vigente", organize a análise sempre pelos resultados da coluna Segmento e pelos indicadores do extrato. Apresente os resultados dos segmentos disponíveis, sem criar agrupamentos por EPS.

Em "Pontos de atenção e plano de ação", use somente Segmento, operação, meta, realizado, projeção, atingimento, GAP, produtividade e problemas sistêmicos. Não utilize EPS como dimensão, filtro, comparação ou justificativa.

A competência vigente é o padrão. Só use competência anterior quando ela estiver explícita na pergunta e aparecer em competenciaAplicada.

Os totais representam registros encontrados nas bases operacionais. Sempre chame NR Smiles de "número de membro" nas respostas ao usuário.

Rankings de agentes devem contar exclusivamente nomes preenchidos na coluna Agente. Nunca inclua BRASIL, ARGENTINA, Não informado, País, EPS ou Segmento no ranking.

Quando a consulta for específica da Pessoalize, use Rep Vendas/Login como responsável, pois a coluna Agente pode estar vazia nessa EPS.

Quando a pergunta mencionar PAs da Pessoalize, use as quantidades distintas de Rep Vendas em Vendas e de Login em Upgrade já calculadas pelo JavaScript.

Quando a pergunta usar "ontem", respeite a data exata calculada pelo JavaScript como hoje menos um dia.

Para Upgrade, a data de referência é sempre a coluna A (dt_solicitacao).

Quando houver exclusão de plano, como "não foi 1.000", respeite o filtro e não recoloque o plano excluído na análise.

Faça uma análise objetiva, fácil de ler e focada em concentração, diferenças relevantes, evolução por data e pontos de atenção sustentados pelos números.

Quando a pergunta pedir resultados dia a dia, apresente cada data em ordem cronológica acompanhada de sua quantidade de vendas, upgrades ou registros do segmento solicitado.

Use problemasSistemicos para enriquecer o resumo quando houver conteúdo, sem presumir impacto ou causalidade não demonstrada.

Cada problema sistêmico está associado à operação da mesma linha do Extrato. Respeite obrigatoriamente essa associação e a competência aplicada: nunca atribua o problema de uma operação a outro segmento.

Quando a pergunta indicar uma operação ou segmento, apresente somente os problemas correspondentes a essa operação.

Quando os dados não forem suficientes para entender ou responder com segurança, peça ao usuário que reformule informando operação, filial/EPS, período e agrupamento.

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

    const parts =
      result?.candidates?.[0]?.content?.parts || [];

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
