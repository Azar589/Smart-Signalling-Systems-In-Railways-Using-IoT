#include <RH_ASK.h>
#include <SPI.h>
#include <WiFi.h>
#include <HTTPClient.h>

RH_ASK rf_driver(2000, 16, -1, -1);
WiFiClient client;
HTTPClient http;

unsigned long lastUploadTime = 0;
const long uploadInterval = 16000; // 16 seconds for ThingSpeak free tier

void ConnectToWIFI() {
  WiFi.mode(WIFI_STA);
  WiFi.begin("Azar's M34", "azar@2005");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");
}

void thingSpeakWrite(String data) {
  // Check if enough time has passed since last upload
  if (millis() - lastUploadTime > uploadInterval) {
    String url = "http://api.thingspeak.com/update?api_key=12WTGAIJQYNRUL22&field1=" + data;
    http.begin(client, url);
    int httpcode = http.GET();
    
    if (httpcode > 0) {
      Serial.println("Cloud Sync Successful: " + data);
      lastUploadTime = millis();
    } else {
      Serial.println("HTTP Error: " + String(httpcode));
    }
    http.end();
  } else {
    Serial.println("Upload throttled (Waiting for 15s limit)");
  }
}

void setup() {
  Serial.begin(115200);
  if (!rf_driver.init()) Serial.println("RF Init Failed");
  ConnectToWIFI();
}

void loop() {
  // Max message length + 1 for null terminator to prevent overflow
  uint8_t buf[RH_ASK_MAX_MESSAGE_LEN + 1]; 
  uint8_t buflen = sizeof(buf) - 1;

  if (rf_driver.recv(buf, &buflen)) {
    buf[buflen] = '\0'; // Properly terminate the string
    String receivedData = (char*)buf;
    Serial.println("Received RF: " + receivedData);
    
    thingSpeakWrite(receivedData);
  }
}