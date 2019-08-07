#include <stdio.h>

int main() {
  // Can you see what happens in a universe made of numbers?
  int i_am_a_int = 3; 
  double i_am_a_double = 2.0;
  float i_am_a_float = 2.0;
  
  int what_am_i_int = i_am_a_int / i_am_a_double;
  float what_am_i_float = i_am_a_int / i_am_a_float;
  double what_am_i_double = i_am_a_int / i_am_a_double;

  printf('%d %f %lf\n', what_am_i_int, what_am_i_float, what_am_i_double);
}
