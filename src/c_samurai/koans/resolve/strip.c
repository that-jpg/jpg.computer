#include <stdio.h>

void strip(char string[], int size) {
  return;
}

int main() {
  char string[] = "   Strip me   a      ";

  int string_size = 256;
  strip(string, string_size);
  printf("%s \n", string);
}
