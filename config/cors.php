<?php

return [
    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => ['*'], // untuk development, longgarkan dulu

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => ['X-Correlation-Id'], // header custom kita dari middleware sebelumnya

    'max_age' => 0,

    'supports_credentials' => false,
];