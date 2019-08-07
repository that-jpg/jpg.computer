#include <stdio.h>

int get_tinyest(int numbers[], int size) {
  return 666;
}

int main() {
  int numbers[6];
  int size = 10;

  numbers[0] = 4;
  numbers[1] = 8;
  numbers[2] = 15;
  numbers[3] = 16;
  numbers[4] = 23;
  numbers[5] = 42;

  int tinyest = get_tinyest(numbers, size);
  printf("I'm the tinyest: %d \n", tinyest);
}
