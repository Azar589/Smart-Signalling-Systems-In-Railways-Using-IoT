#include <RH_ASK.h>
#include <SPI.h>
#include <WiFi.h>
#include <HTTPClient.h>
RH_ASK rf_driver(2000, 16, -1, -1);  // (bitrate, RX, TX, PTT)
WiFiClient client;
HTTPClient http;
int num;
//LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
void ConnectToWIFI() {
  WiFi.mode(WIFI_STA);
  WiFi.begin("Azar's M34", "azar@2005");
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(200);
  }
  Serial.println();
  Serial.println("IP Address");
  Serial.println(WiFi.localIP());
  Serial.println("MAC Address");
  Serial.println(WiFi.macAddress());
}
void thingSpeakWrite(String data) {
  String url = "http://api.thingspeak.com/update?api_key=12WTGAIJQYNRUL22&field1=" + data;
  http.begin(client, url);
  Serial.println("Waiting for Response...");
  int httpcode = http.GET();
 
  if (httpcode > 0) {
    Serial.println("Data Sent Successfully: " + data);
  } else {
    Serial.println("Error Sending Data");
  }
 
  http.end();
}
void setup() {
  Serial.begin(115200);
  rf_driver.init();
  ConnectToWIFI();
  Serial.print("\nSIGNAL STATUS");
  Serial.print("\n");
  //lcd.begin(16, 2);
  //lcd.print("SIGNAL STATUS");
}
void loop() {
  String dataToSend;
  uint8_t buf[RH_ASK_MAX_MESSAGE_LEN];
  delay(100);
  uint8_t buflen = sizeof(buf);
  if (rf_driver.recv(buf, &buflen))
  {
    buf[buflen] = '\0';
    Serial.print("\nReceived: ");
    Serial.println((char*)buf);
    dataToSend = (char*)buf;
    delay(500);
    thingSpeakWrite(dataToSend);
  }
}
