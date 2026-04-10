#include <stdio.h>

void remove_number(int numbers[], int size, int position) {
  return;
}

void remove_string(char string[], int size, int position) {
  return;
}

int main() {
  int i = 0;

  int numbers[3] = {1, 2, 3};
  int numbers_size = 3;
  remove_number(numbers, numbers_size, 1);
  for (i = 0; i < 3; i++) {
    printf("%d, ", numbers[i]);
  }
  printf("\n");

  char string[256] = "Essa # frase esta boa!";
  int string_size = 256;
  remove_string(string, string_size, 10);
  printf("%s \n", string);
}
