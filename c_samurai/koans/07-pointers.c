#include <stdio.h>
#include <stdlib.h>

int main() {
  int b = 10;
  printf("%p \n", &b);

  int *a;
  a = malloc(sizeof(int));
  a[0] = 1;
  printf("-- %d \n", *a);
  *a = 2;
  printf("%d \n", *a);
  free(a);
}
