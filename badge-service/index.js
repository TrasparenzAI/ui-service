// index.js
const echarts = require('echarts');
const sharp = require('sharp');
const express = require('express');
const { buildGaugeOption } = require('./gauge-options');

const app = express();
const RESULT_API_URL = process.env.RESULT_API_URL;
const API_URL = process.env.API_URL;
const RULE_API_URL = process.env.RULE_API_URL;

function countRules(node) {
  let count = 1; // conta questo nodo
  if (node.childs) {
    for (const child of Object.values(node.childs)) {
      count += countRules(child);
    }
  }
  return count;
}

// Recupera root_rule dal config-service
async function getRootRule() {
  const response = await fetch(`${API_URL}/config-service/properties`);
  if (!response.ok) throw new Error('Config service non raggiungibile');
  const data = await response.json();
  const properties = data._embedded?.properties ?? [];
  const cronBody = properties.find(p => p.key === 'workflow.cron.body');
  if (!cronBody) throw new Error('workflow.cron.body non trovato');
  const body = JSON.parse(cronBody.value);
  return body.input.root_rule; 
}

// Recupera il totale delle regole dal rule-service
async function getTotalRules(rootRule) {
  const response = await fetch(`${RULE_API_URL}/v1/rules`);
  if (!response.ok) throw new Error(`Rule service non raggiungibile`);
  const allRules = await response.json();
  const rootNode = allRules[rootRule];
  if (!rootNode) throw new Error(`Root rule '${rootRule}' non trovata in jsonrules`);

  const total = Object.values(rootNode.childs ?? {})
    .reduce((sum, child) => sum + countRules(child), 0) + 1;
  
  return total;
}

app.get('/badge/:codiceIpa.png', async (req, res) => {
  try {
    const { codiceIpa } = req.params;
    // parametri opzionali con default
    const width  = parseInt(req.query.width)  || 400;
    const height = parseInt(req.query.height) || 300;

    console.log('[REQUEST BADGE]', {
      codiceIpa,
      width,
      height,
      time: new Date().toISOString()
    });

    // 1. Recupera root_rule dalla configurazione
    const rootRule = await getRootRule();
    
    const url = `${RESULT_API_URL}/v1/results/codiceipa?codiceIpa=${codiceIpa}&size=500&noCache=true`;

    const response = await fetch(url);
    if (!response.ok) return res.status(404).end();
    const data = await response.json();
    const resultsArray = data.content || []; 

    // 2. Filtra sull'array identificato
    const rulesOK = resultsArray.filter(r => r.status == 200 || r.status == 202).length;

    const totalRules = await getTotalRules(rootRule); 

    const gaugeData = {
      rulesOK: rulesOK,
      total: totalRules,
      denominazioneEnte: resultsArray[0].company.denominazioneEnte,
      codiceIpa
    };

    // ECharts SSR ufficiale — genera SVG senza browser né canvas
    const chart = echarts.init(null, null, {
      renderer: 'svg',
      ssr: true,
      width: width,
      height: height
    });

    chart.setOption(buildGaugeOption(gaugeData, {
      showTitle: true,
      containerWidth: width + 250,
      showToolbox: false,
      ssr: true
    }));

    const svgStr = chart.renderToSVGString();
    chart.dispose();

    // SVG → PNG con sharp
    const buffer = await sharp(Buffer.from(svgStr))
      .png()
      .toBuffer();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');          // 1 giorno browser
    res.setHeader('Expires', new Date(Date.now() + 86400000).toUTCString()); // fallback HTTP/1.0
    res.setHeader('ETag', `${codiceIpa}-${width}-${height}`);         // revalidazione
    res.end(buffer);

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(3001, () => console.log('Badge service on :3001'));