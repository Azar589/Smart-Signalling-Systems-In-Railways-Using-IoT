#include <RH_ASK.h>
#include <SPI.h>

RH_ASK rf_driver(2000, -1, 4, -1); 

const int red_l=0, yellow_l=2, green_l=14;
const int red_s=5, yellow_s=12, green_s=13;

String lastStatus = ""; // To track the previous state

void setup() {
  Serial.begin(115200);
  if (!rf_driver.init()) Serial.println("RF Init Failed");
  
  pinMode(red_l, OUTPUT); pinMode(yellow_l, OUTPUT); pinMode(green_l, OUTPUT);
  pinMode(red_s, INPUT); pinMode(yellow_s, INPUT); pinMode(green_s, INPUT);
}

void loop() {
  String currentStatus = "";

  // Determine current signal state
  if(digitalRead(red_s) == HIGH) {
    digitalWrite(red_l, HIGH);
    currentStatus = "RED";
  } else digitalWrite(red_l, LOW);

  if(digitalRead(yellow_s) == HIGH) {
    digitalWrite(yellow_l, HIGH);
    currentStatus = "YELLOW";
  } else digitalWrite(yellow_l, LOW);

  if(digitalRead(green_s) == HIGH) {
    digitalWrite(green_l, HIGH);
    currentStatus = "GREEN";
  } else digitalWrite(green_l, LOW);

  // Only send if the status has changed and isn't empty
  if (currentStatus != "" && currentStatus != lastStatus) {
    const char *msg = currentStatus.c_str();
    rf_driver.send((uint8_t *)msg, strlen(msg));
    rf_driver.waitPacketSent();
    Serial.println("Change Detected. Message Sent: " + currentStatus);
    lastStatus = currentStatus;
  }
  delay(50); // Small debounce/stability delay
}