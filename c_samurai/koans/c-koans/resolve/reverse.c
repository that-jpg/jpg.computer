#include <stdio.h>

void reverse(char string[], int size) {
  return;
}

int main() {
  char word1[] = "aibofobia";
  int word1_size = 9;
  reverse(word1, word1_size);
  printf("%s \n", word1);

  char word2[] = "Essa aqui reverte";
  int word2_size = 17;
  reverse(word2, word2_size);
  printf("%s \n", word2);

  char word3[] = "lagel otium e gpj O";
  int word3_size = 19;
  reverse(word3, word3_size);
  printf("%s \n", word3);
}
