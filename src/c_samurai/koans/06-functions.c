#include <stdio.h>

int wololo(int a) {
  return a + 1;
}

int main() {
  int a;
  scanf("%d", &a);
  int b = wololo(a);
  printf("Meu numero %d \n", b);
}
