#include <stdio.h>

int sum(int numbers[], int size) {
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

  int sum_of_numbers = sum(numbers, size);
  printf("I'm more than the sum of the parts? %d \n", sum_of_numbers);
}
