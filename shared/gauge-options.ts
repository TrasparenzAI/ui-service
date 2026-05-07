export interface GaugeData {
  rulesOK: number;
  total: number;
  denominazioneEnte: string;
  codiceIpa: string;
}

export interface GaugeBand {
  color: string;
  min: number;
  max: number;
}

export function buildBands(max: number): GaugeBand[] {
  return [
    { color: '#ee1f25', min: 0, max: max / 6.3 },
    { color: '#f04922', min: max / 6.3, max: max / (6.3 / 2) },
    { color: '#fdae19', min: max / (6.3 / 2), max: max / (6.3 / 3) },
    { color: '#b0d136', min: max / (6.3 / 3), max: max / (6.3 / 4) },
    { color: '#54b947', min: max / (6.3 / 4), max: max / (6.3 / 5) },
    { color: '#0f9747', min: max / (6.3 / 5), max: max }
  ];
}

export function toPercent(value: number, max: number): number {
  return max > 0 ? (value / max) * 100 : 0;
}

export interface GaugeOptions {
  showTitle?: boolean;
  containerWidth?: number;
  showToolbox?: boolean;
  ssr?: boolean;
}

export function getColorForValue(value: number, total: number): string {
  const bands = buildBands(total);
  // Cerchiamo la prima banda il cui valore 'max' è maggiore o uguale a rulesOK
  const activeBand = bands.find(b => value <= b.max);
  // Restituiamo il colore della banda trovata, o l'ultimo colore come fallback
  return activeBand ? activeBand.color : bands[bands.length - 1].color;
}

export function buildGaugeOption(data: GaugeData, opts: GaugeOptions = {}) {
  const { ssr = false } = opts;
  const { rulesOK, total, denominazioneEnte, codiceIpa } = data;
  const { showTitle = true, containerWidth = 400, showToolbox = false } = opts;

  const bands = buildBands(total);
  const axisLineSegments = bands.map(b => [toPercent(b.max, total) / 100, b.color]);
  // CALCOLA IL COLORE DETERMINISTICO
  const currentColor = getColorForValue(rulesOK, total);
  return {
    title: showTitle ? {
      text: denominazioneEnte,
      left: 'center',
      top: 5,
      textStyle: {
        color: '#000000',
        fontSize: 14,
        fontWeight: 'bold',
        fontFamily: 'monospace',
        overflow: 'break',
        width: containerWidth
      },
      padding: [0, 0, 0, 0]
    } : {},

    toolbox: showToolbox ? {
      feature: {
        saveAsImage: {
          title: 'Salva immagine',
          name: `indicatori_${codiceIpa}`
        }
      }
    } : {},

    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        splitNumber: 6,
        radius: '120%',
        center: ['50%', '70%'],
        axisLine: {
          lineStyle: {
            width: 40,
            color: axisLineSegments
          }
        },
        pointer: {
          length: '70%',
          width: 12,
          itemStyle: { color: currentColor }
        },
        axisTick: {
          distance: 8,
          length: 8,
          lineStyle: { color: '#fff', width: 2 }
        },
        splitLine: {
          distance: 8,
          length: 14,
          lineStyle: { color: '#fff', width: 3 }
        },
        axisLabel: {
          color: '#000',
          fontSize: 18,
          distance: 50,
          formatter: (value: number) => String(Math.round((value / 100) * total))
        },
        anchor: {
          show: true,
          showAbove: true,
          size: 25,
          itemStyle: {
            color: '#4e6fce',
            borderColor: '#fff',
            borderWidth: 3
          }
        },
        detail: {
          valueAnimation: true,
          color: 'inherit',
          fontSize: 38,
          fontWeight: 'bold',
          offsetCenter: [0, '-20%'],
          formatter: (value: number) => String(Math.round((value / 100) * total))
        },
        data: [
          {
            value: toPercent(rulesOK, total),
            name: ''
          }
        ],
        animation: !ssr,
        animationDuration: ssr ? 0 : 1500,        
        animationEasing: 'cubicInOut'
      }
    ]
  };
}