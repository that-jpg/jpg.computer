n = input()

rs = 0
var = 10
d = n % var
n /= 10
rs += d+1
m = 10 if d == 9 else 1
while (n > 0):
  d = n % var
  n /= 10
  rs += (d+1) * (var * m)
  m *= 100 if d == 9 else 10


print(rs)
