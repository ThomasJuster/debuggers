<?php

$arr = [];
for ($i = 0; $i < 100; $i++) {
    $arr[$i] = $i;
}

foreach ($arr as $key => $val) {
    if (isset($arr[$key - 1])) {
        $arr[$key] += $arr[$key - 1];
    }
}

echo $arr[count($arr) - 1];
