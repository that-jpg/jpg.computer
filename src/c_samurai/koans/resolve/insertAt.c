#include <stdio.h>

void insertAt_number(int numbers[], int size, int position, int value) {
  return;
}

void insertAt_string(char string[], int size, int position) {
  return;
}

int main() {
  int i = 0;

  int numbers[3] = {1, 2, 3};
  int numbers_size = 3;
  insertAt_number(numbers, numbers_size, 2, 666);
  for (i = 0; i < 3; i++) {
    printf("%d, ", numbers[i]);
  }
  printf("\n");

  char string[256] = "Eu sou um() string?";
  int string_size = 256;
  insertAt_string(string, string_size, 10);
  printf("%s \n", string);

}
