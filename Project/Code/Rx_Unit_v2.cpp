#include <RH_ASK.h>
#include <SPI.h>
#include <WiFi.h>
#include <HTTPClient.h>

RH_ASK rf_driver(2000, 16, -1, -1);
WiFiClient client;
HTTPClient http;

// ─────────────────────────────────────────
//  ThingSpeak Config
// ─────────────────────────────────────────
const String THINGSPEAK_API_KEY = "12WTGAIJQYNRUL22"; // ThingSpeak Write API Key
const long   UPLOAD_INTERVAL    = 16000;               // 16s (ThingSpeak free tier limit)

// ─────────────────────────────────────────
//  Data Queue (Buffer)
// ─────────────────────────────────────────
const int    QUEUE_SIZE  = 20;          // Max 20 pending entries
String       queue[QUEUE_SIZE];         // Stores signal status strings
int          queueHead   = 0;           // Next item to send
int          queueTail   = 0;           // Next empty slot to write
int          queueCount  = 0;           // Current items in queue

unsigned long lastUploadTime = -UPLOAD_INTERVAL; // First upload never rate-limited

// ─────────────────────────────────────────
//  Security
// ─────────────────────────────────────────
const char   XOR_KEY     = 0x5A;        // Must match Tx unit
const String EXPECTED_ID = "TX1";
unsigned int lastSeqNum  = 0;

// ─────────────────────────────────────────
//  Queue Operations
// ─────────────────────────────────────────
bool enqueue(String data) {
  if (queueCount >= QUEUE_SIZE) {
    Serial.println("⚠ Queue Full! Dropping oldest entry: " + queue[queueHead]);
    // Drop oldest to make room for newest
    queueHead = (queueHead + 1) % QUEUE_SIZE;
    queueCount--;
  }
  queue[queueTail] = data;
  queueTail = (queueTail + 1) % QUEUE_SIZE;
  queueCount++;
  Serial.println("Queued [" + String(queueCount) + "/" + String(QUEUE_SIZE) + "]: " + data);
  return true;
}

String dequeue() {
  if (queueCount == 0) return "";
  String data = queue[queueHead];
  queue[queueHead] = "";             // Clear the slot
  queueHead = (queueHead + 1) % QUEUE_SIZE;
  queueCount--;
  return data;
}

// ─────────────────────────────────────────
//  Decryption
// ─────────────────────────────────────────
void encryptDecrypt(char* data, int len) {
  for (int i = 0; i < len; i++) {
    data[i] ^= XOR_KEY;
  }
}

// ─────────────────────────────────────────
//  WiFi
// ─────────────────────────────────────────
void ConnectToWIFI() {
  WiFi.mode(WIFI_STA);
  WiFi.begin("Azar's M34", "azar@2005");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
}

// ─────────────────────────────────────────
//  Cloud Upload (sends ONE item from queue)
// ─────────────────────────────────────────
void processQueue() {
  if (queueCount == 0) return; // Nothing to send

  unsigned long now = millis();
  if (now - lastUploadTime < UPLOAD_INTERVAL) return; // Rate limit not expired yet

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected! Reconnecting...");
    ConnectToWIFI();
  }

  String data = dequeue(); // Take one item from the front
  if (data == "") return;

  String url = "http://api.thingspeak.com/update?api_key=" + THINGSPEAK_API_KEY + "&field1=" + data;
  http.begin(client, url);
  int httpcode = http.GET();

  if (httpcode == 200) {
    String response = http.getString();
    if (response.toInt() > 0) {
      Serial.println("✔ Cloud Sync OK | Entry#: " + response + " | Data: " + data
                     + " | Queue Remaining: " + String(queueCount));
      lastUploadTime = millis(); // Reset timer only on success
    } else {
      // ThingSpeak rejected — requeue the item so it's not lost
      Serial.println("✘ Rejected by ThingSpeak (returned 0). Requeueing: " + data);
      enqueue(data);
    }
  } else {
    // Network error — requeue the item so it's not lost
    Serial.println("✘ HTTP Error: " + String(httpcode) + ". Requeueing: " + data);
    enqueue(data);
  }
  http.end();
}

// ─────────────────────────────────────────
//  Setup
// ─────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  rf_driver.init();
  ConnectToWIFI();
  Serial.println("RX Unit v2 Ready (Queue Mode).");
}

// ─────────────────────────────────────────
//  Main Loop
// ─────────────────────────────────────────
void loop() {
  // ── 1. Receive RF data ──
  uint8_t buf[RH_ASK_MAX_MESSAGE_LEN + 1];
  uint8_t buflen = sizeof(buf) - 1;

  if (rf_driver.recv(buf, &buflen)) {
    buf[buflen] = '\0';

    encryptDecrypt((char*)buf, buflen);
    String payload = (char*)buf;

    int firstComma  = payload.indexOf(',');
    int secondComma = payload.indexOf(',', firstComma + 1);

    if (firstComma > 0 && secondComma > 0) {
      String       deviceID   = payload.substring(0, firstComma);
      unsigned int recSeqNum  = payload.substring(firstComma + 1, secondComma).toInt();
      String       statusData = payload.substring(secondComma + 1);

      if (deviceID == EXPECTED_ID) {
        if (recSeqNum > lastSeqNum) {
          Serial.println("Validated [Seq:" + String(recSeqNum) + "]: " + statusData);
          lastSeqNum = recSeqNum;
          enqueue(statusData); // ← Store in queue instead of direct upload
        } else {
          Serial.println("Blocked: Replay Attack. Seq=" + String(recSeqNum) + " Last=" + String(lastSeqNum));
        }
      } else {
        Serial.println("Blocked: Unknown Device ID: " + deviceID);
      }
    } else {
      Serial.println("Blocked: Malformed Packet: " + payload);
    }
  }

  // ── 2. Upload from queue every 16s ──
  processQueue();
}
