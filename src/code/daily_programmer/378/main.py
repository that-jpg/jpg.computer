def warmup1(numbers):
  return filter(lambda x: x != '0', numbers)

def warmup2(numbers):
  return reversed(sorted(numbers))

def warmup3(n, numbers):
  return int(n) > len(list(numbers))

def warmup4(n, numbers):
  rs = []
  for index, n in enumerate(numbers):
    nn = int(n)
    rs.append(nn if index < nn else nn - 1)

  return rs

def hh(numbers):
  # Remove all 0's from the sequence
  w1 = list(warmup1(numbers))

  # If the sequence is now empty (no elements left), stop and return true
  if (len(w1) == 0):
    return True

  # Sort the sequence in descending order (i.e. warmup2). 
  w2 = list(warmup2(w1))

  # Remove the first answer (which is also the largest answer, or tied for the largest) from the sequence and call it N. The sequence is now 1 shorter than it was after the previous step.
  # If N is greater than the length of this new sequence (i.e. warmup3), stop and return false.
  w3 = warmup3(w2[0], w2[1:])
  if (w3):
    return False

  w4 = warmup4(w2[0], w2[1:])

  return hh(w4)


input_list = str(input())

numbers = if (input_list == ''):
  print('true')
else:
  print(hh(list(input_list.split(' '))))

