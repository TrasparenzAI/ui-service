# UI - Service

[![license](https://img.shields.io/badge/License-AGPL%20v3-blue.svg?logo=gnu&style=for-the-badge)](../main/LICENSE)
[![Docker Image](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)](../../pkgs/container/ui-service)
[![Build Status](https://github.com/TrasparenzAI/ui-service/actions/workflows/build.yml/badge.svg)](https://github.com/TrasparenzAI/ui-service/actions/workflows/build.yml)
[![Angular](https://img.shields.io/badge/angular-%23DD0031.svg?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev/)
[![Bootstrap](https://img.shields.io/badge/bootstrap-%238511FA.svg?style=for-the-badge&logo=bootstrap&logoColor=white)](https://getbootstrap.com/)

## Introduzione
UI Service è parte della suite di servizi per la verifica delle informazioni sulla Trasparenza dei siti web delle Pubbliche amministrazioni italiane.
Integra e mostra i dati presenti nei vari servizi fornendo la possibilità, avendo gli opportuni permessi, di attivare le funzionalità preposte all'inserimento e alla cancellazione degli stessi, inoltre è possibile attivare l'autenticazione su tutte le pagine, o in alternativa di accedere senza autenticazione per la sola consultazione dei dati per poi richiederla successivamente.  

![Home Page](home.png)

# Indice

- [Dipendenze principali](#dipendenze-principali)
- [Variabili di Ambiente](#variabili-di-ambiente)
- [Autorizzazioni](#autorizzazioni)
- [Come installare](#come-installare)
- [Docker](#docker)
- [Badge Service](#badge-service)
- [Come contribuire](#come-contribuire)
- [Licenza](#licenza)

## Dipendenze principali
| Nome                                                              | Versione |
|-------------------------------------------------------------------|----------|
| [Angular](https://angular.dev/)                                   | 21.2.1   |
| [Apache ECharts](https://echarts.apache.org/)                     | 21.0.0   |
| [Leaflet](https://leafletjs.com/)                                 | 1.9.4    |
| [d3-org-chart](https://github.com/bumbeishvili/org-chart)         | 3.1.1    |
| [bootstrap-italia](https://italia.github.io/bootstrap-italia/)    | 2.17.4   |
| [Design Angular Kit](https://italia.github.io/design-angular-kit) | 21.2.0   |

## Variabili di Ambiente

| Nome                       | Valore di default                  | Descrizione                                                                                            |
|----------------------------|------------------------------------|--------------------------------------------------------------------------------------------------------|
| BASE_HREF                  | /                                  | URL di base da usare per tutti i link relativi                                                         |
| API_URL                    | https://dica33.ba.cnr.it           | URL di riferimento dei servizi                                                                         |
| COMPANY_API_URL            | $API_URL/public-sites-service      | URL del servizio [public-sites-service](https://github.com/TrasparenzAI/public-sites-service)          |
| CONDUCTOR_API_URL          | $API_URL/conductor-server          | URL del servizio [conductor-service](https://github.com/TrasparenzAI/conductor)                        |
| RESULT_API_URL             | $API_URL/result-service            | URL del servizio [result-service](https://github.com/TrasparenzAI/result-service)                      |
| RESULT_AGGREGATOR_API_URL  | $API_URL/result-aggregator-service | URL del servizio [result-aggregator-service](https://github.com/TrasparenzAI/result-aggregator-service)|
| TASK_SCHEDULER_API_URL     | $API_URL/task-scheduler-service    | URL del servizio [task-scheduler-service](https://github.com/TrasparenzAI/task-scheduler-service)      |
| RULE_API_URL               | $API_URL/rule-service              | URL del servizio [rule-service](https://github.com/TrasparenzAI/rule-service)                          |
| CRAWLER_API_URL            | $API_URL/crawl                     | URL del servizio [crawler-service](https://github.com/TrasparenzAI/crawler-service)                    |
| AI_API_URL                 | $API_URL/ai-integration-service    | URL del servizio [ai-integration-service](https://github.com/TrasparenzAI/ai-integration-service)      |
| MCP_API_URL                | $API_URL/mcp-server                | URL del servizio [mcp-server](https://github.com/TrasparenzAI/mcp-server)                              |
| OIDC_ENABLE                | false                              | Parametro che indica se è attiva l'autenticazione tramite protocollo basato su OAuth 2.0               |
| OIDC_FORCE                 | false                              | Parametro che indica se l'autenticazione viene forzata su tutte le pagine                              |
| OIDC_AUTHORITY             |                                    | URL del servizio authority di norma è nella forma ```.../.well-known/openid-configuration```           |
| OIDC_REDIRECTURL           | http://localhost/auth/signin       | URL necessiaria per il redirect dopo l'accesso                                                         |
| OIDC_CLIENTID              | angular-public                     | Identificativo del client da usare, va impostato sul sistema di autenticazione                         |
| OIDC_POSTLOGOUTREDIRECTURL |                                    | URL da utilizzare dopo aver effettuato il logout può essere anche vuoto                                |
| MATOMO_ENABLE              | false                              | Parametro che indica se è attivo il tracciamento delle pagine con Matomo                               |
| MATOMO_TRAKER_URL          |                                    | URL del servizio ad esempio [Matomo](https://dica33.ba.cnr.it/matomo/matomo.php)                       |
| MATOMO_SITE_ID             |                                    | Identificatvo del sito da usare.                                                                       |

## Autorizzazioni

Nella enumeration [role.enum.ts](src/app/auth/role.enum.ts) sono definiti i ruoli gestiti all'interno del servizio, il ruolo viene recuperato dal TOKEN JWT, nello specifico dai ruoli presenti all'interno dell'attributo **"realm_access"**:

```json
"realm_access": {
    "roles": [
      "ROLE_SUPERUSER",
      "default-roles-trasparenzai",
      "offline_access",
      "uma_authorization"
    ]
}
```

# Come installare

## 🐧 Installare npm su Linux
Il metodo consigliato è installare Node.js, che include anche npm.

✅ Metodo 1: Usare il gestore di pacchetti della distro
### Ubuntu/Debian
```bash
sudo apt update
sudo apt install nodejs npm
```
Verifica:

```bash
node -v
npm -v
```
### Fedora
```bash
sudo dnf install nodejs
```

### Arch Linux / Manjaro
```bash
sudo pacman -S nodejs npm
```

✅ Metodo 2: Usare Node Version Manager (nvm) – consigliato

- Installa nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

- Chiudi e riapri il terminale, poi esegui:

```bash
nvm install --lts
nvm use --lts
```

- Verifica installazione:

```bash
node -v
npm -v
```

✅ Vantaggi: puoi gestire più versioni di Node.js!

## 🪟 Installare npm su Windows

### ✅ Metodo consigliato: Installer ufficiale di Node.js

- Vai su https://nodejs.org
- Scarica la versione LTS (Long Term Support)
- Esegui il file .msi e segui le istruzioni (assicura che sia selezionata l'opzione per installare anche npm)
- Una volta terminato, apri il terminale (cmd o PowerShell) e verifica:

```bash
node -v
npm -v
```

## Installare le dipendenze e avviare il servizio
Dopo aver installato npm si può procedere all'installazzione dei pacchetti definiti all'interno del file [package.json](package.json) con la seguente istruzione:

```bash
npm install
```

Dopo aver installato le dipendenze e modificato il file [env.js](src/assets/env.js) con i parametri corretti si può avviare il servizio con la seguente istruzione:

```bash
npm start
```

Verrà aperta un finestra del browser predefinito alla URL http://localhost:4200/#/

# 🐳 Docker

### Installazione
- Installa Docker Linux: Segui la guida su https://docs.docker.com/engine/install/
- Windows/Mac: Scarica Docker Desktop da https://www.docker.com/products/docker-desktop

Il servizio è dotato di un [Dockerfile](Dockerfile) e tramite [GitHub Action](.github/workflows/build.yml) pubblica le immagini su [ghcr.io](https://github.com/TrasparenzAI/ui-service/pkgs/container/ui-service).

Per avviare il servizio tramite docker, impostando correttamente le [variabili d'ambiente](#variabili-di-ambiente), basta eseguire la seguente istruzione:  

```bash
docker run -p 80:80 -e OIDC_ENABLE=true ghcr.io/trasparenzai/ui-service:latest
```

# 🏅 Badge Service

Il Badge Service è un microservizio Node.js integrato all'interno del container Docker del UI Service. Viene avviato automaticamente da `supervisord` insieme a nginx ed è raggiungibile **esclusivamente tramite nginx** sulla porta 80 — non è esposto direttamente all'esterno.

## Funzionamento

Dato il `codiceIpa` di un'amministrazione pubblica, il servizio:

1. Recupera la `root_rule` attiva dal `config-service` (chiave `workflow.cron.body`)
2. Interroga il `rule-service` per calcolare il **numero totale di regole** definite nell'albero gerarchico
3. Interroga il `result-service` per ottenere i risultati di verifica dell'ente (`/v1/results/codiceipa?codiceIpa=...`)
4. Conta le regole con esito positivo (status `200` o `202`)
5. Genera un **gauge chart** tramite Apache ECharts in modalità SSR (server-side rendering, senza browser)
6. Converte il grafico SVG in **PNG** tramite [sharp](https://sharp.pixelplumbing.com/)
7. Restituisce l'immagine con header di cache HTTP (1 giorno)

## Endpoint

```
GET /badge/{codiceIpa}.png
```

| Parametro    | Tipo    | Obbligatorio | Default | Descrizione                        |
|--------------|---------|--------------|---------|------------------------------------|
| `codiceIpa`  | path    | ✅           | —       | Codice IPA dell'ente               |
| `width`      | query   | ❌           | `400`   | Larghezza dell'immagine in pixel   |
| `height`     | query   | ❌           | `300`   | Altezza dell'immagine in pixel     |

### Esempi

```
# Badge con dimensioni di default
GET /badge/cnr.png

# Badge con dimensioni personalizzate
GET /badge/cnr.png?width=600&height=450
```

### Risposta

| Campo            | Valore                             |
|------------------|------------------------------------|
| Content-Type     | `image/png`                        |
| Cache-Control    | `public, max-age=86400` (1 giorno) |
| ETag             | `{codiceIpa}-{width}-{height}`     |

In caso di ente non trovato viene restituito `404`. In caso di errore sui servizi upstream viene restituito `500` con il dettaglio dell'errore in JSON.

## Dipendenze principali

| Libreria                                         | Versione  | Scopo                                                |
|--------------------------------------------------|-----------|------------------------------------------------------|
| [express](https://expressjs.com/)                | ^4.19.0   | Server HTTP                                          |
| [echarts](https://echarts.apache.org/)           | ^5.5.0    | Generazione gauge chart in modalità SSR              |
| [sharp](https://sharp.pixelplumbing.com/)        | ^0.34.5   | Conversione SVG → PNG                                |
| [ts-node](https://typestrong.org/ts-node/)       | ^10.9.2   | Esecuzione TypeScript condiviso (`gauge-options.ts`) |

## Architettura interna

Il routing nginx instrада le richieste verso il badge service tramite la seguente configurazione in `nginx/default.conf`:

```nginx
location ^~ /badge/ {
    proxy_pass http://127.0.0.1:3001/badge/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_cache_valid 200 1d;
    add_header Cache-Control "public, max-age=86400";
}
```

Il codice sorgente si trova in [`badge-service/index.js`](badge-service/index.js). La logica di costruzione del gauge è condivisa con il frontend Angular tramite il file [`shared/gauge-options.ts`](shared/gauge-options.ts), che definisce le bande di colore, il calcolo delle percentuali e le opzioni ECharts.

## Variabili di ambiente utilizzate

| Nome             | Descrizione                                                     |
|------------------|-----------------------------------------------------------------|
| `API_URL`        | URL base dei servizi, usato per raggiungere il `config-service` |
| `RESULT_API_URL` | URL del `result-service` da cui recuperare i risultati per ente |
| `RULE_API_URL`   | URL del `rule-service` da cui recuperare l'albero delle regole  |

## 👏 Come Contribuire 

E' possibile contribuire a questo progetto utilizzando le modalità standard della comunità opensource 
(issue + pull request) e siamo grati alla comunità per ogni contribuito a correggere bug e miglioramenti.

## 📄 Licenza

UI Service è concesso in licenza GNU AFFERO GENERAL PUBLIC LICENSE, come si trova 
nel file [LICENSE][l].

[l]: LICENSE