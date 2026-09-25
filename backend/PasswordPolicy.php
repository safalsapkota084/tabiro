<?php
declare(strict_types=1);
namespace Tabiro;

final class PasswordPolicy {
    public static function validate(mixed $password): string {
        if (!is_string($password) || strlen($password) < 12 || strlen($password) > 72 || str_contains($password, "\0")) {
            throw new ApiError(422, 'validation', 'Use a password between 12 and 72 bytes.', ['password' => 'invalid']);
        }
        return $password;
    }
}
