<?php
declare(strict_types=1);
namespace Tabiro;
final class ApiError extends \RuntimeException {
 public function __construct(public readonly int $status, public readonly string $errorCode, string $message, public readonly array $fields=[]) {parent::__construct($message);}
}
