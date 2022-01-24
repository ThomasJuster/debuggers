<?php

$arr = [];
$str = '';
function test(int $a, int $b): int
{
    global $arr, $str;

    $arr[] = rand(0, 10);
    $str .= 'a';

    if ($a == 0) {
        return 1;
    }
    if ($b == 0) {
        return 1 + test($a - 1, $b = 2);
    }

    return 1 + test($a, $b - 1);
}

function run(): void
{
    $r = test(2, 2);
    echo "Done!";
}

echo "Hello";
run();

var_dump($arr);
echo substr($str, 0, 5);
