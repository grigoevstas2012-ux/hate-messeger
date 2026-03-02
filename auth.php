<?php
/**
 * PHP Authentication Backend for Firebase
 * Security layer for user registration and authentication
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$action = $_GET['action'] ?? '';

// ── SECURITY: Rate limiting ──
session_start();
$ip = $_SERVER['REMOTE_ADDR'];
$rate_limit_key = "rate_limit_$ip";

if (!isset($_SESSION[$rate_limit_key])) {
    $_SESSION[$rate_limit_key] = [];
}

// Clean old timestamps (older than 1 minute)
$_SESSION[$rate_limit_key] = array_filter($_SESSION[$rate_limit_key], function($t) {
    return (time() - $t) < 60;
});

// Allow max 5 requests per minute
if (count($_SESSION[$rate_limit_key]) >= 5) {
    http_response_code(429);
    echo json_encode(['error' => 'Too many requests. Try again later.']);
    exit();
}

$_SESSION[$rate_limit_key][] = time();

// ── INPUT VALIDATION ──
function validate_email($email) {
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    return strlen($email) <= 255;
}

function sanitize_input($input) {
    return trim(htmlspecialchars($input, ENT_QUOTES, 'UTF-8'));
}

// ── HANDLERS ──
switch ($action) {
    case 'register':
        handle_register();
        break;
    case 'validate_email':
        handle_validate_email();
        break;
    case 'check_user':
        handle_check_user();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
}

function handle_register() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON']);
        return;
    }

    $email = sanitize_input($input['email'] ?? '');
    $name = sanitize_input($input['name'] ?? '');
    $password = $input['password'] ?? ''; // Don't sanitize password
    
    // Validation
    if (!validate_email($email)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid email format']);
        return;
    }

    if (strlen($name) < 2 || strlen($name) > 50) {
        http_response_code(400);
        echo json_encode(['error' => 'Name must be between 2 and 50 characters']);
        return;
    }

    if (strlen($password) < 8) {
        http_response_code(400);
        echo json_encode(['error' => 'Password must be at least 8 characters']);
        return;
    }

    // Check for common weak passwords
    $weak_passwords = ['12345678', 'password', 'qwerty123', 'admin1234', '11111111'];
    if (in_array(strtolower($password), $weak_passwords)) {
        http_response_code(400);
        echo json_encode(['error' => 'Password is too weak. Choose a stronger password']);
        return;
    }

    // Here you would typically:
    // 1. Check if email already exists in database
    // 2. Hash password with bcrypt or similar
    // 3. Store user in database
    
    // For now, return success validation response
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Registration data validated successfully',
        'data' => [
            'email' => $email,
            'name' => $name,
            'timestamp' => date('Y-m-d H:i:s')
        ]
    ]);
}

function handle_validate_email() {
    $input = json_decode(file_get_contents('php://input'), true);
    $email = sanitize_input($input['email'] ?? '');
    
    if (!validate_email($email)) {
        http_response_code(400);
        echo json_encode(['valid' => false, 'error' => 'Invalid email']);
        return;
    }

    // Check if email is already registered (would query database)
    // For now, simulate check
    http_response_code(200);
    echo json_encode([
        'valid' => true,
        'available' => true,
        'email' => $email
    ]);
}

function handle_check_user() {
    $input = json_decode(file_get_contents('php://input'), true);
    $uid = sanitize_input($input['uid'] ?? '');
    
    if (empty($uid)) {
        http_response_code(400);
        echo json_encode(['error' => 'User ID required']);
        return;
    }

    // Query user from database
    http_response_code(200);
    echo json_encode([
        'exists' => false,
        'uid' => $uid
    ]);
}

?>
