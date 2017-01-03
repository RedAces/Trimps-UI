<?php
require_once __DIR__ . '/WarpstationSim.php';

/**
 * Ziel: Graphen von Housing over Cost für versch. Strategien X+y
 * X + G*Y Warpstations pro Gigastation-Upgrade kaufen
 * (G = Level of bought Gigastations)
 */

$sim = new WarpstationSim();
?>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <style type="text/css">
        table {
            border-collapse: collapse;
        }
        table td, table th {
            border: 1px solid grey;
            padding: 2px 5px;
        }
        .right {
            text-align: right;
        }
    </style>
</head>
<body>
    <h2>Graph</h2>
    <div id="graph-container"></div>

    <h2>Raw Data</h2>

    <?php

    $dataSets = [
        [14, 4], // reference

        [14, 3],
        [14, 2],
    ];
    $gigastations   = 5;
    $series         = [];
    $referencePoint = null;
    foreach ($dataSets as $set) {
        if ($referencePoint === null) {
            $data           = $sim->calculateGraphData($set[0], $set[1], $gigastations);
            $referencePoint = end($data);
        } else {
            $data = $sim->calculateGraphData($set[0], $set[1], $gigastations, $referencePoint['cost'], $referencePoint['housing']);
        }

        $series[] = [
            'name' => $set[0] . '+' . $set[1],
            'data' => $data,
        ];
    }

    foreach ($series as $serieKey => $serie) : ?>
        <table>
            <thead>
                <tr class="toggle" data-target="tr.dataset-<?= str_replace('+', '-', $serie['name']); ?>">
                    <th><?= $serie['name']; ?></th>
                    <th>Housing</th>
                    <th>Cost</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($serie['data'] as $pointKey => $point) : ?>
                    <tr class="dataset-<?= str_replace('+', '-', $serie['name']); ?>">
                        <td>
                            <?= substr($point['label'], 1); ?>
                        </td>
                        <td class="right">
                            <?= round($point['housing'], 2); ?>
                        </td>
                        <td class="right">
                            <?= round($point['cost'], 2); ?>
                        </td>
                    </tr>
                <?php
                $series[$serieKey]['data'][$pointKey] = [$point['housing'], $point['cost']];
                endforeach; ?>
            </tbody>
        </table>
    <?php endforeach; ?>
    <script src="https://code.jquery.com/jquery-3.1.1.min.js"></script>
    <script src="https://code.highcharts.com/highcharts.js"></script>
    <script type="application/javascript">
        $(function () {
            $('#graph-container').highcharts({
                title: {
                    text: 'Housing vs Cost für versch. Warp- / Gigastation-Strategien',
                    x: -20 //center
                },
                xAxis: {
                    title: {
                        text: 'Housing (in 10k)'
                    }
                },
                yAxis: {
                    title: {
                        text: 'Cost (in 100e9 Gems / 1e15 Metal)'
                    }
//                    plotLines: [
//                        {
//                            value: 0,
//                            width: 1,
//                            color: '#808080'
//                        }
//                    ],
//                    type: 'logarithmic'
                },
                legend: {
                    layout: 'vertical',
                    align: 'right',
                    verticalAlign: 'middle',
                    borderWidth: 0
                },
                series: <?= json_encode($series); ?>
            });

            $('tr.toggle').click(function() {
                console.debug($(this).data('target'));
                $($(this).data('target')).toggle();
            });
        });
    </script>
</body>
</html>
