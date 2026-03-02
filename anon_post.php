<?php
// Simple PHP forwarder example — posts received messages to a Cloud Function endpoint.
// Deploy the Cloud Function and set $FUNCTION_URL to its HTTPS URL.
$FUNCTION_URL = 'https://us-central1-your-project.cloudfunctions.net/anonMessage';

// Read POST body
$body = file_get_contents('php://input');
if (!$body) {
    http_response_code(400);
    echo json_encode(['error' => 'Empty body']);
    exit;
}

// Optional: sanitize or perform server-side checks here

$ch = curl_init($FUNCTION_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
$response = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
if ($response === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Forward failed']);
    exit;
}
http_response_code($code);
echo $response;

?>