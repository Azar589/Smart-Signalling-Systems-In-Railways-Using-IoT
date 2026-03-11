#include <RH_ASK.h>
#include <SPI.h>
RH_ASK rf_driver(2000, -1, 4, -1);  // (bitrate, RX, TX, PTT)
const int red_l=0;
const int yellow_l=2;
const int green_l=14;
const int red_s=5;
const int yellow_s=12;
const int green_s=13;
void setup() {
  Serial.begin(115200);
  rf_driver.init();
  pinMode(red_l,OUTPUT);
  pinMode(yellow_l,OUTPUT);
  pinMode(green_l,OUTPUT);
  pinMode(red_s,INPUT);
  pinMode(yellow_s,INPUT);
  pinMode(green_s,INPUT);
}
void loop() {
  if(digitalRead(red_s) == HIGH)
  {
    digitalWrite(red_l,HIGH);
    const char *msg = "RED";
    rf_driver.send((uint8_t *)msg, strlen(msg));
    Serial.println("Message Sent: RED");
  }else{
    digitalWrite(red_l,LOW);
  }
  if(digitalRead(yellow_s) == HIGH)
  {
    digitalWrite(yellow_l,HIGH);
    const char *msg = "YELLOW";
    rf_driver.send((uint8_t *)msg, strlen(msg));
    Serial.println("Message Sent: YELLOW");
  }else{
    digitalWrite(yellow_l,LOW);
  }
  if(digitalRead(green_s) == HIGH)
  {
    digitalWrite(green_l,HIGH);
    const char *msg = "GREEN";
    rf_driver.send((uint8_t *)msg, strlen(msg));
    Serial.println("Message Sent: GREEN");
  }else{
    digitalWrite(green_l,LOW);
  }
  rf_driver.waitPacketSent();
}
